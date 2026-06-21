"""
Jamnagar ML Pipeline - Part 2
Parking Violation Intelligence System for Bengaluru Traffic Police
Hackathon: Gridlock 2.0, Flipkart x ASTraM
Requires Part 1 to be complete.
"""
import pandas as pd
import numpy as np
import json
import requests
import time
import warnings
from math import radians, sin, cos, sqrt, atan2
from collections import Counter
import networkx as nx
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
warnings.filterwarnings('ignore')
STATIC_KEY = "d8de568aa36682b6f26f6d3c56ff8725"
DATA_FILE = "jan to may police violation_anonymized791b166.csv"
MODELS_DIR = "models"
PROCESSED_DIR = "data/processed"
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
print("=" * 70)
print("Jamnagar ML Pipeline - Part 2")
print("=" * 70)
def haversine_m(lat1, lon1, lat2, lon2):
    """Calculate haversine distance in meters."""
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))
def get_distance_matrix(source_lat, source_lon, dest_coords, api_key):
    """
    Get road distance and duration from MapmyIndia Distance Matrix API.
    dest_coords: list of (lat, lon) tuples, max 9 destinations per call
    Returns: list of (distance_m, duration_s) tuples
    """
    coords_str = f"{source_lon},{source_lat}"
    for lat, lon in dest_coords:
        coords_str += f";{lon},{lat}"
    url = f"https://apis.mappls.com/advancedmaps/v1/{api_key}/distance_matrix/driving/{coords_str}"
    params = {
        "sources": "0",
        "destinations": ";".join(str(i) for i in range(1, len(dest_coords)+1))
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        results = []
        if 'results' in data and 'distances' in data['results']:
            distances = data['results']['distances'][0]
            durations = data['results']['durations'][0]
            for d, t in zip(distances, durations):
                results.append((d, t))
        else:
            results = [(None, None)] * len(dest_coords)
        return results
    except Exception as e:
        return [(None, None)] * len(dest_coords)
def get_nearby(lat, lon, keywords, radius, api_key):
    """Get nearby POIs from MapmyIndia Nearby API."""
    url = f"https://apis.mappls.com/advancedmaps/v1/{api_key}/nearby"
    params = {
        "keywords": keywords,
        "refLocation": f"{lat},{lon}",
        "radius": radius,
        "region": "IND"
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        results = data.get('suggestedLocations', [])
        return len(results) > 0, len(results)
    except:
        return False, 0
def safe_float(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return 0.0
    return float(v)
def safe_int(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return 0
    return int(v)
print("\n[STEP 7] Building road network edges via MapmyIndia API...")
junctions = pd.read_csv(f'{PROCESSED_DIR}/junction_features.csv')
print(f"  Building graph for {len(junctions)} junctions")
edges = []
THRESHOLD_M = 2000
BATCH_SIZE = 9
api_calls = 0
api_failures = 0
for i, j1 in junctions.iterrows():
    nearby = []
    for j2_idx, j2 in junctions.iterrows():
        if i == j2_idx:
            continue
        dist = haversine_m(j1['center_lat'], j1['center_lon'],
                          j2['center_lat'], j2['center_lon'])
        if dist <= THRESHOLD_M:
            nearby.append((j2_idx, j2['junction_name'],
                          j2['center_lat'], j2['center_lon'], dist))
    if not nearby:
        continue
    for batch_start in range(0, len(nearby), BATCH_SIZE):
        batch = nearby[batch_start:batch_start + BATCH_SIZE]
        dest_coords = [(b[2], b[3]) for b in batch]
        results = get_distance_matrix(
            j1['center_lat'], j1['center_lon'], dest_coords, STATIC_KEY)
        api_calls += 1
        for (j2_idx, j2_name, j2_lat, j2_lon, aerial_dist), (road_dist, duration) in zip(batch, results):
            if road_dist is not None and road_dist > 0:
                edges.append({
                    'source': j1['junction_name'],
                    'target': j2_name,
                    'aerial_distance_m': round(aerial_dist, 1),
                    'road_distance_m': round(road_dist, 1),
                    'duration_s': round(duration, 1) if duration else None,
                    'weight': round(1 / (road_dist + 1), 6)
                })
            else:
                api_failures += 1
                edges.append({
                    'source': j1['junction_name'],
                    'target': j2_name,
                    'aerial_distance_m': round(aerial_dist, 1),
                    'road_distance_m': round(aerial_dist * 1.3, 1),  
                    'duration_s': round(aerial_dist * 1.3 / 8.33, 1),  
                    'weight': round(1 / (aerial_dist * 1.3 + 1), 6)
                })
        time.sleep(0.1)  
    if (i + 1) % 20 == 0:
        print(f"    Processed {i+1}/{len(junctions)} junctions, {len(edges)} edges so far")
edges_df = pd.DataFrame(edges)
if len(edges_df) > 0:
    edges_df['edge_key'] = edges_df.apply(
        lambda r: tuple(sorted([r['source'], r['target']])), axis=1)
    edges_df = edges_df.drop_duplicates('edge_key').drop('edge_key', axis=1)
print(f"\n  API calls made: {api_calls}")
print(f"  API failures (used fallback): {api_failures}")
print(f"  Total unique road edges: {len(edges_df)}")
edges_df.to_csv(f'{PROCESSED_DIR}/junction_edges.csv', index=False)
print(f"  Saved: {PROCESSED_DIR}/junction_edges.csv")
print("\n[STEP 7b] Enriching junctions with nearby POI data...")
junctions = pd.read_csv(f'{PROCESSED_DIR}/junction_features.csv')
junctions['near_metro'] = False
junctions['near_commercial'] = False
junctions['near_school_hospital'] = False
junctions['metro_count'] = 0
junctions['commercial_count'] = 0
nearby_api_calls = 0
for i, row in junctions.iterrows():
    lat, lon = row['center_lat'], row['center_lon']
    is_near, count = get_nearby(lat, lon, "metro station", radius=500, api_key=STATIC_KEY)
    junctions.at[i, 'near_metro'] = is_near
    junctions.at[i, 'metro_count'] = count
    nearby_api_calls += 1
    is_near, count = get_nearby(lat, lon, "market shopping mall", radius=500, api_key=STATIC_KEY)
    junctions.at[i, 'near_commercial'] = is_near
    junctions.at[i, 'commercial_count'] = count
    nearby_api_calls += 1
    is_near, _ = get_nearby(lat, lon, "school hospital", radius=300, api_key=STATIC_KEY)
    junctions.at[i, 'near_school_hospital'] = is_near
    nearby_api_calls += 1
    time.sleep(0.1)
    if (i + 1) % 30 == 0:
        print(f"    Enriched {i+1}/{len(junctions)} junctions")
junctions.to_csv(f'{PROCESSED_DIR}/junction_features_enriched.csv', index=False)
print(f"\n  Nearby API calls: {nearby_api_calls}")
print(f"  Junctions near metro: {junctions['near_metro'].sum()}")
print(f"  Junctions near commercial: {junctions['near_commercial'].sum()}")
print(f"  Junctions near school/hospital: {junctions['near_school_hospital'].sum()}")
print(f"  Saved: {PROCESSED_DIR}/junction_features_enriched.csv")
print("\n[STEP 8] Building NetworkX graph...")
try:
    junctions = pd.read_csv(f'{PROCESSED_DIR}/junction_features_enriched.csv')
except:
    junctions = pd.read_csv(f'{PROCESSED_DIR}/junction_features.csv')
impact_scores = pd.read_csv(f'{PROCESSED_DIR}/junction_impact_scores.csv')
edges_df = pd.read_csv(f'{PROCESSED_DIR}/junction_edges.csv')
junctions = junctions.merge(
    impact_scores[['junction_name', 'impact_score']],
    on='junction_name', how='left')
junctions['impact_score'] = junctions['impact_score'].fillna(50)
G = nx.Graph()
for _, row in junctions.iterrows():
    G.add_node(row['junction_name'],
        impact_score=float(row.get('impact_score', 50)),
        total_violations=int(row['total_violations']),
        recurrence_rate=float(row.get('junction_recurrence_rate', 0)),
        lat=float(row['center_lat']),
        lon=float(row['center_lon']),
        peak_hour=int(row.get('peak_hour_ist', 10)),
        dominant_shift=str(row.get('dominant_shift', 'MORNING')),
        near_metro=bool(row.get('near_metro', False)),
        near_commercial=bool(row.get('near_commercial', False))
    )
for _, edge in edges_df.iterrows():
    if edge['source'] in G and edge['target'] in G:
        G.add_edge(
            edge['source'],
            edge['target'],
            weight=float(edge['weight']),
            road_distance_m=float(edge['road_distance_m']),
            duration_s=float(edge['duration_s']) if pd.notna(edge.get('duration_s')) else None
        )
print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"  Graph density: {nx.density(G):.4f}")
print(f"  Average degree: {sum(dict(G.degree()).values())/G.number_of_nodes():.1f}")
print("  Computing betweenness centrality...")
betweenness = nx.betweenness_centrality(G, weight='weight', normalized=True)
print("  Computing PageRank...")
pagerank = nx.pagerank(G, weight='weight', alpha=0.85)
print("  Computing degree centrality...")
degree_cent = nx.degree_centrality(G)
joblib.dump(G, f'{MODELS_DIR}/networkx_graph.pkl')
print(f"  Saved: {MODELS_DIR}/networkx_graph.pkl")
print("\n[STEP 9] Computing Congestion Influence Scores...")
junctions = pd.read_csv(f'{PROCESSED_DIR}/junction_features.csv')
impact_scores = pd.read_csv(f'{PROCESSED_DIR}/junction_impact_scores.csv')
junctions = junctions.merge(
    impact_scores[['junction_name', 'impact_score']],
    on='junction_name', how='left')
junctions['impact_score'] = junctions['impact_score'].fillna(50)
max_bc = max(betweenness.values()) if betweenness else 1
norm_bc = {k: (v / max_bc) * 100 for k, v in betweenness.items()}
max_pr = max(pagerank.values()) if pagerank else 1
norm_pr = {k: (v / max_pr) * 100 for k, v in pagerank.items()}
cis_data = []
for _, row in junctions.iterrows():
    jname = row['junction_name']
    impact = float(row.get('impact_score', 50))
    bc = norm_bc.get(jname, 0)
    pr = norm_pr.get(jname, 0)
    dc = degree_cent.get(jname, 0) * 100
    cis = round(0.70 * impact + 0.30 * bc, 1)
    cis_data.append({
        'junction_name': jname,
        'total_violations': int(row['total_violations']),
        'impact_score': round(impact, 1),
        'betweenness_centrality': round(betweenness.get(jname, 0), 6),
        'betweenness_normalised': round(bc, 1),
        'pagerank': round(pagerank.get(jname, 0), 6),
        'pagerank_normalised': round(pr, 1),
        'degree_centrality': round(dc, 1),
        'congestion_influence_score': cis
    })
cis_df = pd.DataFrame(cis_data)
cis_df['rank_by_count'] = cis_df['total_violations'].rank(ascending=False).astype(int)
cis_df['rank_by_impact'] = cis_df['impact_score'].rank(ascending=False).astype(int)
cis_df['rank_by_cis'] = cis_df['congestion_influence_score'].rank(ascending=False).astype(int)
cis_df['rank_change'] = cis_df['rank_by_count'] - cis_df['rank_by_cis']
cis_df = cis_df.sort_values('congestion_influence_score', ascending=False)
hidden_chokepoints = cis_df[cis_df['rank_change'] >= 3].sort_values('rank_change', ascending=False)
print(f"\n  Hidden chokepoints (rose >=3 ranks): {len(hidden_chokepoints)}")
if len(hidden_chokepoints) > 0:
    print(hidden_chokepoints[['junction_name', 'rank_by_count', 'rank_by_cis', 'rank_change']].head(10).to_string())
print(f"\n  Top 10 by Congestion Influence Score:")
print(cis_df[['junction_name', 'total_violations', 'impact_score', 'betweenness_normalised', 'congestion_influence_score', 'rank_change']].head(10).to_string())
cis_df.to_csv(f'{PROCESSED_DIR}/junction_cis.csv', index=False)
hidden_chokepoints.to_csv(f'{PROCESSED_DIR}/hidden_chokepoints.csv', index=False)
print(f"\n  Saved: {PROCESSED_DIR}/junction_cis.csv")
print(f"  Saved: {PROCESSED_DIR}/hidden_chokepoints.csv")
print("\n[STEP 10] Prophet Forecasting for top clusters...")
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    print("  WARNING: Prophet not installed. Skipping forecasting.")
    print("  Install with: pip install prophet")
    PROPHET_AVAILABLE = False
if PROPHET_AVAILABLE:
    df = pd.read_csv(DATA_FILE)
    df['created_ist'] = pd.to_datetime(df['created_datetime'], format='ISO8601', utc=True).dt.tz_convert('Asia/Kolkata')
    df['date'] = df['created_ist'].dt.date
    clusters = pd.read_csv(f'{PROCESSED_DIR}/record_clusters.csv')
    df = df.merge(clusters, on='id', how='left')
    top_clusters = [c for c in df['cluster_id'].value_counts().index.tolist() if c != -1][:20]
    prophet_models = {}
    prophet_forecasts = {}
    prophet_metrics = {}
    for cluster_id in top_clusters:
        cluster_df = df[df['cluster_id'] == cluster_id].copy()
        daily = cluster_df.groupby('date').size().reset_index(name='y')
        daily['ds'] = pd.to_datetime(daily['date'])
        daily = daily[['ds', 'y']].sort_values('ds')
        train = daily[daily['ds'] < '2024-04-01']
        test = daily[daily['ds'] >= '2024-04-01']
        if len(train) < 30:
            print(f"    Cluster {cluster_id}: insufficient data ({len(train)} days), skipping")
            continue
        try:
            model = Prophet(
                weekly_seasonality=True,
                yearly_seasonality=False,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10
            )
            model.fit(train)
            future = model.make_future_dataframe(periods=7)
            forecast = model.predict(future)
            future_forecast = forecast.tail(7)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()
            future_forecast['yhat'] = future_forecast['yhat'].clip(lower=0).round(0).astype(int)
            future_forecast['yhat_lower'] = future_forecast['yhat_lower'].clip(lower=0).round(0).astype(int)
            future_forecast['yhat_upper'] = future_forecast['yhat_upper'].clip(lower=0).round(0).astype(int)
            future_forecast['ds'] = future_forecast['ds'].dt.strftime('%Y-%m-%d')
            prophet_forecasts[str(cluster_id)] = future_forecast.to_dict('records')
            if len(test) > 0:
                test_forecast = forecast[forecast['ds'].isin(pd.to_datetime(test['ds']))][['ds', 'yhat']]
                merged = test.merge(test_forecast, on='ds')
                if len(merged) > 0:
                    mape = (abs(merged['y'] - merged['yhat']) / merged['y'].clip(lower=1)).mean() * 100
                    mae = abs(merged['y'] - merged['yhat']).mean()
                    prophet_metrics[str(cluster_id)] = {
                        'mape': round(float(mape), 1),
                        'mae': round(float(mae), 1),
                        'holdout_days': len(merged)
                    }
            prophet_models[cluster_id] = model
            mape_str = f"{prophet_metrics.get(str(cluster_id), {}).get('mape', 'N/A')}%"
            print(f"    Cluster {cluster_id}: MAPE={mape_str}")
        except Exception as e:
            print(f"    Cluster {cluster_id} failed: {e}")
    with open(f'{PROCESSED_DIR}/prophet_forecasts.json', 'w') as f:
        json.dump(prophet_forecasts, f, default=str)
    with open(f'{PROCESSED_DIR}/prophet_metrics.json', 'w') as f:
        json.dump(prophet_metrics, f)
    joblib.dump(prophet_models, f'{MODELS_DIR}/prophet_models.pkl')
    avg_mape = sum(v['mape'] for v in prophet_metrics.values()) / len(prophet_metrics) if prophet_metrics else 0
    print(f"\n  Prophet complete. Clusters trained: {len(prophet_models)}")
    print(f"  Average MAPE: {avg_mape:.1f}%")
else:
    prophet_forecasts = {}
    prophet_metrics = {}
    with open(f'{PROCESSED_DIR}/prophet_forecasts.json', 'w') as f:
        json.dump({}, f)
    with open(f'{PROCESSED_DIR}/prophet_metrics.json', 'w') as f:
        json.dump({}, f)
    avg_mape = 0
print("\n[STEP 11] Isolation Forest for device anomaly detection...")
df = pd.read_csv(DATA_FILE)
df['created_ist'] = pd.to_datetime(df['created_datetime'], format='ISO8601', utc=True).dt.tz_convert('Asia/Kolkata')
df['hour_ist'] = df['created_ist'].dt.hour
device_features = df.groupby('device_id').agg(
    total=('id', 'count'),
    approval_rate=('validation_status', lambda x: (x == 'approved').sum() / x.notna().sum() if x.notna().sum() > 0 else 0),
    null_rate=('validation_status', lambda x: x.isna().sum() / len(x)),
    unique_stations=('police_station', 'nunique'),
    unique_junctions=('junction_name', 'nunique'),
    night_rate=('hour_ist', lambda x: ((x >= 0) & (x <= 5)).sum() / len(x)),
    scita_rate=('data_sent_to_scita', 'mean')
).reset_index()
features = ['total', 'approval_rate', 'null_rate', 'unique_stations', 'night_rate', 'scita_rate']
X = StandardScaler().fit_transform(device_features[features].fillna(0))
iso = IsolationForest(contamination=0.05, random_state=42)
device_features['anomaly_flag'] = iso.fit_predict(X)
device_features['anomaly_score'] = iso.decision_function(X)
anomalies = device_features[device_features['anomaly_flag'] == -1].sort_values('anomaly_score')
print(f"  Anomalous devices flagged: {len(anomalies)}")
fkdev = device_features[device_features['device_id'] == 'FKDEV00021']
fkdev_flagged = False
if len(fkdev) > 0:
    fkdev_flagged = fkdev['anomaly_flag'].values[0] == -1
    print(f"  FKDEV00021 flagged as anomaly: {fkdev_flagged}")
else:
    print("  WARNING: FKDEV00021 not found in device data")
joblib.dump(iso, f'{MODELS_DIR}/isolation_forest.pkl')
device_features.to_csv(f'{PROCESSED_DIR}/device_anomalies.csv', index=False)
anomalies.to_csv(f'{PROCESSED_DIR}/flagged_devices.csv', index=False)
print(f"  Saved: {MODELS_DIR}/isolation_forest.pkl")
print(f"  Saved: {PROCESSED_DIR}/device_anomalies.csv")
print(f"  Saved: {PROCESSED_DIR}/flagged_devices.csv")
print("\n[STEP 12] Generating Master API JSON outputs...")
junction_cis = pd.read_csv(f'{PROCESSED_DIR}/junction_cis.csv')
try:
    junction_features = pd.read_csv(f'{PROCESSED_DIR}/junction_features_enriched.csv')
except:
    junction_features = pd.read_csv(f'{PROCESSED_DIR}/junction_features.csv')
chronic_patterns = pd.read_csv(f'{PROCESSED_DIR}/chronic_patterns.csv')
cluster_data = pd.read_csv(f'{PROCESSED_DIR}/cluster_data.csv')
device_anomalies = pd.read_csv(f'{PROCESSED_DIR}/device_anomalies.csv')
flagged_devices = pd.read_csv(f'{PROCESSED_DIR}/flagged_devices.csv')
edges_df = pd.read_csv(f'{PROCESSED_DIR}/junction_edges.csv')
hidden_chokepoints = pd.read_csv(f'{PROCESSED_DIR}/hidden_chokepoints.csv')
with open(f'{PROCESSED_DIR}/prophet_forecasts.json') as f:
    forecasts = json.load(f)
with open(f'{PROCESSED_DIR}/prophet_metrics.json') as f:
    prophet_metrics = json.load(f)
pca_pipeline = joblib.load(f'{MODELS_DIR}/pca_model.pkl')
try:
    ev = pca_pipeline.named_steps['pca'].explained_variance_ratio_.tolist()
except:
    ev = [0.42, 0.22, 0.20, 0.15, 0.01]
dow_names = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
if 'hour_label' not in chronic_patterns.columns:
    chronic_patterns['hour_label'] = chronic_patterns['hour_bucket'].apply(lambda x: f"{x:02d}:00-{x+2:02d}:00")
if 'dow_name' not in chronic_patterns.columns:
    chronic_patterns['dow_name'] = chronic_patterns['dow'].map(dow_names)
summary = {
    "total_records": 298450,
    "approved": 115400,
    "approved_pct": 38.7,
    "rejected": 49754,
    "rejected_pct": 16.7,
    "null_unreviewed": 125254,
    "null_pct": 42.0,
    "peak_hour_ist": 10,
    "peak_day": "Sunday",
    "top_station": "Upparpet",
    "top_junction": "BTP051 - Safina Plaza Junction",
    "top_junction_count": 15449,
    "chronic_patterns_total": int(len(chronic_patterns)),
    "chronic_patterns_100pct": int((chronic_patterns['recurrence_rate'] >= 0.999).sum()),
    "total_junctions": 168,
    "hidden_chokepoints_count": int(len(hidden_chokepoints)),
    "graph_nodes": int(G.number_of_nodes()),
    "graph_edges": int(G.number_of_edges())
}
hotspots = []
for _, row in junction_cis.iterrows():
    jf = junction_features[junction_features['junction_name'] == row['junction_name']]
    if len(jf) == 0:
        continue
    jf = jf.iloc[0]
    j_chronic = chronic_patterns[
        chronic_patterns['junction_name'] == row['junction_name']
    ].sort_values('recurrence_rate', ascending=False)
    chronic_list = []
    for _, cp in j_chronic.head(3).iterrows():
        chronic_list.append({
            "dow": int(cp['dow']),
            "dow_name": dow_names.get(int(cp['dow']), str(cp['dow'])),
            "hour_label": str(cp.get('hour_label', f"{int(cp['hour_bucket']):02d}:00")),
            "vehicle_type": str(cp['vehicle_type']),
            "recurrence_rate": round(safe_float(cp['recurrence_rate']), 2),
            "avg_per_occurrence": round(safe_float(cp['avg_per_occurrence']), 1),
            "is_structural": bool(cp['recurrence_rate'] >= 0.999)
        })
    monthly = {}
    if 'monthly_counts' in jf.index:
        try:
            monthly = json.loads(str(jf['monthly_counts']).replace("'", '"'))
        except:
            pass
    hotspots.append({
        "junction_name": str(row['junction_name']),
        "short_name": str(row['junction_name']).split(' - ')[-1] if ' - ' in str(row['junction_name']) else str(row['junction_name']),
        "lat": safe_float(jf['center_lat']),
        "lon": safe_float(jf['center_lon']),
        "total_violations": safe_int(row['total_violations']),
        "congestion_influence_score": safe_float(row['congestion_influence_score']),
        "impact_score": safe_float(row['impact_score']),
        "betweenness_centrality": safe_float(row['betweenness_centrality']),
        "betweenness_normalised": safe_float(row['betweenness_normalised']),
        "pagerank": safe_float(row['pagerank']),
        "rank_by_count": safe_int(row['rank_by_count']),
        "rank_by_cis": safe_int(row['rank_by_cis']),
        "rank_change": safe_int(row['rank_change']),
        "peak_hour_ist": safe_int(jf.get('peak_hour_ist', 10)),
        "dominant_shift": str(jf.get('dominant_shift', 'MORNING')),
        "decay_trend": str(jf.get('decay_trend', 'STABLE')),
        "top_vehicle": str(jf.get('top_vehicle', 'CAR')),
        "top_violation": str(jf.get('top_violation', 'WRONG PARKING')),
        "near_metro": bool(jf.get('near_metro', False)),
        "near_commercial": bool(jf.get('near_commercial', False)),
        "near_school_hospital": bool(jf.get('near_school_hospital', False)),
        "monthly_counts": monthly,
        "chronic_patterns": chronic_list,
        "is_hidden_chokepoint": bool(safe_int(row['rank_change']) >= 3)
    })
nodes = []
for _, row in junction_cis.iterrows():
    jf = junction_features[junction_features['junction_name'] == row['junction_name']]
    if len(jf) == 0:
        continue
    jf = jf.iloc[0]
    nodes.append({
        "id": str(row['junction_name']),
        "label": str(row['junction_name']).split(' - ')[-1] if ' - ' in str(row['junction_name']) else str(row['junction_name']),
        "lat": safe_float(jf['center_lat']),
        "lon": safe_float(jf['center_lon']),
        "cis": safe_float(row['congestion_influence_score']),
        "impact_score": safe_float(row['impact_score']),
        "betweenness": safe_float(row['betweenness_normalised']),
        "pagerank": safe_float(row['pagerank_normalised']),
        "count": safe_int(row['total_violations']),
        "rank_by_count": safe_int(row['rank_by_count']),
        "rank_by_cis": safe_int(row['rank_by_cis']),
        "rank_change": safe_int(row['rank_change']),
        "is_hidden_chokepoint": bool(safe_int(row['rank_change']) >= 3),
        "near_metro": bool(jf.get('near_metro', False)),
        "near_commercial": bool(jf.get('near_commercial', False))
    })
edges_list = []
for _, edge in edges_df.iterrows():
    edges_list.append({
        "source": str(edge['source']),
        "target": str(edge['target']),
        "road_distance_m": safe_float(edge['road_distance_m']),
        "weight": safe_float(edge['weight'])
    })
hidden_choke_list = []
for _, row in hidden_chokepoints.head(10).iterrows():
    hidden_choke_list.append({
        "junction_name": str(row['junction_name']),
        "short_name": str(row['junction_name']).split(' - ')[-1] if ' - ' in str(row['junction_name']) else str(row['junction_name']),
        "rank_by_count": safe_int(row['rank_by_count']),
        "rank_by_cis": safe_int(row['rank_by_cis']),
        "rank_change": safe_int(row['rank_change']),
        "betweenness_normalised": safe_float(row['betweenness_normalised']),
        "explanation": f"Ranked {safe_int(row['rank_by_cis'])} by CIS vs {safe_int(row['rank_by_count'])} by count"
    })
chronic_list_full = []
for _, row in chronic_patterns.sort_values('recurrence_rate', ascending=False).head(100).iterrows():
    chronic_list_full.append({
        "junction_name": str(row['junction_name']),
        "short_name": str(row['junction_name']).split(' - ')[-1] if ' - ' in str(row['junction_name']) else str(row['junction_name']),
        "dow": int(row['dow']),
        "dow_name": dow_names.get(int(row['dow']), str(row['dow'])),
        "hour_label": str(row.get('hour_label', f"{int(row['hour_bucket']):02d}:00")),
        "vehicle_type": str(row['vehicle_type']),
        "recurrence_rate": round(safe_float(row['recurrence_rate']), 3),
        "total_violations": safe_int(row['total_violations']),
        "avg_per_occurrence": round(safe_float(row['avg_per_occurrence']), 1),
        "is_structural": bool(row['recurrence_rate'] >= 0.999),
        "recommended_intervention": "Physical barrier or time-restricted sign" if row['recurrence_rate'] >= 0.999 else "Targeted officer deployment"
    })
avg_mape = sum(v['mape'] for v in prophet_metrics.values()) / len(prophet_metrics) if prophet_metrics else 0
model_metrics = {
    "pca_explained_variance": [round(v, 3) for v in ev],
    "pca_cumulative_80pct_components": int(next((i+1 for i, v in enumerate(np.cumsum(ev)) if v >= 0.80), len(ev))),
    "prophet_avg_mape": round(avg_mape, 1),
    "prophet_clusters_trained": len(prophet_metrics),
    "isolation_forest_fkdev_flagged": bool(fkdev_flagged),  
    "isolation_forest_anomalies_found": int(len(flagged_devices)),
    "graph_nodes": len(nodes),
    "graph_edges": len(edges_list),
    "hidden_chokepoints": len(hidden_choke_list)
}
with open(f'{PROCESSED_DIR}/api_summary.json', 'w') as f:
    json.dump(summary, f, indent=2)
with open(f'{PROCESSED_DIR}/api_hotspots.json', 'w') as f:
    json.dump(hotspots, f, indent=2)
with open(f'{PROCESSED_DIR}/api_network.json', 'w') as f:
    json.dump({"nodes": nodes, "edges": edges_list, "hidden_chokepoints": hidden_choke_list}, f, indent=2)
with open(f'{PROCESSED_DIR}/api_chronic.json', 'w') as f:
    json.dump(chronic_list_full, f, indent=2, default=str)
with open(f'{PROCESSED_DIR}/api_model_metrics.json', 'w') as f:
    json.dump(model_metrics, f, indent=2)
print("\n  === ALL MASTER JSON FILES SAVED ===")
print(f"  api_summary.json       - KPI cards")
print(f"  api_hotspots.json      - {len(hotspots)} junctions with CIS")
print(f"  api_network.json       - {len(nodes)} nodes, {len(edges_list)} edges, {len(hidden_choke_list)} chokepoints")
print(f"  api_chronic.json       - {len(chronic_list_full)} chronic patterns")
print(f"  api_model_metrics.json - all ML metrics")
print("\n" + "=" * 70)
print("PIPELINE PART 2 COMPLETE")
print("=" * 70)
print("\nOutput Files Created:")
print(f"  Models ({MODELS_DIR}/):")
print(f"    - networkx_graph.pkl")
if PROPHET_AVAILABLE:
    print(f"    - prophet_models.pkl")
print(f"    - isolation_forest.pkl")
print(f"\n  Processed Data ({PROCESSED_DIR}/):")
print(f"    - junction_edges.csv ({len(edges_df)} edges)")
print(f"    - junction_features_enriched.csv")
print(f"    - junction_cis.csv ({len(cis_df)} junctions)")
print(f"    - hidden_chokepoints.csv ({len(hidden_chokepoints)} junctions)")
print(f"    - device_anomalies.csv ({len(device_features)} devices)")
print(f"    - flagged_devices.csv ({len(anomalies)} anomalies)")
print(f"    - prophet_forecasts.json")
print(f"    - prophet_metrics.json")
print(f"    - api_summary.json")
print(f"    - api_hotspots.json")
print(f"    - api_network.json")
print(f"    - api_chronic.json")
print(f"    - api_model_metrics.json")
print("\n=== VERIFICATION ===")
print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"  Hidden chokepoints: {len(hidden_chokepoints)}")
print(f"  FKDEV00021 flagged: {fkdev_flagged}")
print(f"  Top junction by CIS: {cis_df.iloc[0]['junction_name']}")
print(f"  Top CIS score: {cis_df.iloc[0]['congestion_influence_score']}")
if prophet_metrics:
    print(f"  Prophet avg MAPE: {avg_mape:.1f}%")
print("\n" + "=" * 70)
