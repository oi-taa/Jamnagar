"""
Jamnagar ML Pipeline - Part 1
Parking Violation Intelligence System for Bengaluru Traffic Police
Hackathon: Gridlock 2.0, Flipkart x ASTraM
"""
import pandas as pd
import numpy as np
import json
import warnings
from datetime import datetime
from collections import Counter
from scipy import stats
from scipy.stats import spearmanr
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.pipeline import Pipeline
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score, mean_squared_error, r2_score
import xgboost as xgb
import joblib
import os
warnings.filterwarnings('ignore')
DATA_FILE = "jan to may police violation_anonymized791b166.csv"
MODELS_DIR = "models"
PROCESSED_DIR = "data/processed"
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
SEVERITY_MAP = {
    "DOUBLE PARKING": 1.00,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 0.95,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 0.90,
    "PARKING IN A MAIN ROAD": 0.85,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 0.75,
    "PARKING NEAR ROAD CROSSING": 0.65,
    "WRONG PARKING": 0.50,
    "NO PARKING": 0.50,
    "PARKING ON FOOTPATH": 0.20,
}
def parse_violation_type(v):
    """Parse violation_type JSON array string."""
    if pd.isna(v):
        return []
    try:
        result = json.loads(v)
        return result if isinstance(result, list) else []
    except:
        return []
def compute_road_type_score(location):
    """Compute road type score from location string."""
    if pd.isna(location):
        return 0.2
    loc_lower = location.lower()
    if "outer ring" in loc_lower or "ring road" in loc_lower:
        return 1.0
    elif "main road" in loc_lower:
        return 0.8
    elif "flyover" in loc_lower or "bridge" in loc_lower:
        return 0.7
    elif "junction" in loc_lower:
        return 0.6
    elif "cross road" in loc_lower or "cross" in loc_lower:
        return 0.3
    else:
        return 0.2
def compute_violation_severity(viol_list):
    """Compute max violation severity from list of violation types."""
    if not viol_list:
        return 0.30
    severities = [SEVERITY_MAP.get(v.upper().strip(), 0.30) for v in viol_list]
    return max(severities)
def get_mode(series):
    """Get mode of a series, handling empty cases."""
    if len(series) == 0:
        return None
    mode_result = series.mode()
    return mode_result.iloc[0] if len(mode_result) > 0 else series.iloc[0]
def count_dow_occurrences(dates_series, target_dow):
    """Count how many times a day of week appears in the date range."""
    min_date = dates_series.min().date()
    max_date = dates_series.max().date()
    all_dates = pd.date_range(start=min_date, end=max_date, freq='D')
    return sum(1 for d in all_dates if d.dayofweek == target_dow)
print("=" * 70)
print("Jamnagar ML Pipeline - Part 1")
print("=" * 70)
print("\n[STEP 0] Loading data...")
df = pd.read_csv(DATA_FILE)
print(f"  Total records loaded: {len(df):,}")
print(f"  Columns: {len(df.columns)}")
print("  Converting UTC to IST...")
df['created_datetime'] = pd.to_datetime(df['created_datetime'], format='ISO8601', utc=True)
df['datetime_ist'] = df['created_datetime'].dt.tz_convert('Asia/Kolkata')
df['date_ist'] = df['datetime_ist'].dt.date
df['hour_ist'] = df['datetime_ist'].dt.hour
df['dow'] = df['datetime_ist'].dt.dayofweek  
df['month'] = df['datetime_ist'].dt.month
df['month_name'] = df['datetime_ist'].dt.month_name()
print(f"\n  Data verification:")
print(f"    - Total records: {len(df):,}")
named_junctions = df[df['junction_name'] != 'No Junction']
print(f"    - Named junction records: {len(named_junctions):,}")
print(f"    - Unique named junctions: {named_junctions['junction_name'].nunique()}")
top_junction = df[df['junction_name'] != 'No Junction']['junction_name'].value_counts().head(1)
print(f"    - Top junction: {top_junction.index[0]} ({top_junction.values[0]:,})")
print(f"    - Peak hour IST: {df['hour_ist'].value_counts().idxmax()} ({df['hour_ist'].value_counts().max():,} violations)")
approved = len(df[df['validation_status'] == 'approved'])
print(f"    - Approved: {approved:,} ({100*approved/len(df):.1f}%)")
print("\n[STEP 1] Feature Engineering (record level)...")
print("  Parsing violation_type JSON...")
df['viol_list'] = df['violation_type'].apply(parse_violation_type)
print("  Computing road_type_score...")
df['road_type_score'] = df['location'].apply(compute_road_type_score)
print("  Computing violation_severity...")
df['violation_severity'] = df['viol_list'].apply(compute_violation_severity)
print("  Computing rush_hour_flag...")
df['rush_hour_flag'] = df['hour_ist'].apply(lambda h: 1 if (7 <= h <= 11) or (17 <= h <= 20) else 0)
print("  Computing multi_violation_flag...")
df['multi_violation_flag'] = df['viol_list'].apply(lambda x: 1 if len(x) > 1 else 0)
print("  Computing is_junction...")
df['is_junction'] = df['junction_name'].apply(lambda x: 1 if x != 'No Junction' else 0)
print(f"\n  Feature statistics:")
print(f"    - road_type_score: mean={df['road_type_score'].mean():.3f}")
print(f"    - violation_severity: mean={df['violation_severity'].mean():.3f}")
print(f"    - rush_hour_flag: {df['rush_hour_flag'].sum():,} ({100*df['rush_hour_flag'].mean():.1f}%)")
print(f"    - multi_violation_flag: {df['multi_violation_flag'].sum():,} ({100*df['multi_violation_flag'].mean():.1f}%)")
print(f"    - is_junction: {df['is_junction'].sum():,} ({100*df['is_junction'].mean():.1f}%)")
print("\n[STEP 2] Chronic Recurrence Analysis...")
df_junctions = df[(df['junction_name'] != 'No Junction') & (df['junction_name'].notna())].copy()
print(f"  Working with {len(df_junctions):,} junction records")
df_junctions['hour_bucket'] = (df_junctions['hour_ist'] // 2) * 2
start_date = df_junctions['datetime_ist'].min()
df_junctions['week'] = ((df_junctions['datetime_ist'] - start_date).dt.days // 7).astype(int)
total_weeks = df_junctions['week'].max() - df_junctions['week'].min() + 1
print(f"  Total weeks in date range: {total_weeks}")
print(f"  Date range: {start_date.date()} to {df_junctions['datetime_ist'].max().date()}")
print("  Grouping by junction + dow + hour_bucket + vehicle_type...")
pattern_groups = df_junctions.groupby(['junction_name', 'dow', 'hour_bucket', 'vehicle_type'])
patterns_data = []
for (junction, dow, hour_bucket, vehicle_type), group in pattern_groups:
    total_violations = len(group)
    unique_dates = group['date_ist'].nunique()
    unique_weeks = group['week'].nunique()
    recurrence_rate = unique_weeks / total_weeks if total_weeks > 0 else 0
    avg_per_occurrence = total_violations / unique_weeks if unique_weeks > 0 else 0
    patterns_data.append({
        'junction_name': junction,
        'dow': dow,
        'hour_bucket': hour_bucket,
        'vehicle_type': vehicle_type,
        'total_violations': total_violations,
        'unique_dates': unique_dates,
        'unique_weeks': unique_weeks,
        'possible_weeks': total_weeks,
        'recurrence_rate': recurrence_rate,
        'avg_per_occurrence': avg_per_occurrence
    })
patterns_df = pd.DataFrame(patterns_data)
print(f"  Total patterns analyzed: {len(patterns_df):,}")
chronic_patterns = patterns_df[
    (patterns_df['recurrence_rate'] >= 0.60) &
    (patterns_df['avg_per_occurrence'] >= 3) &
    (patterns_df['unique_weeks'] >= 8)
].copy()
print(f"  Chronic patterns (recurrence>=60%, avg>=3, weeks>=8): {len(chronic_patterns):,}")
print(f"  Patterns at 100% weekly recurrence: {len(patterns_df[patterns_df['recurrence_rate'] >= 0.99]):,}")
chronic_patterns.to_csv(f"{PROCESSED_DIR}/chronic_patterns.csv", index=False)
print(f"  Saved: {PROCESSED_DIR}/chronic_patterns.csv")
junction_chronic = patterns_df.groupby('junction_name').agg(
    junction_recurrence_rate=('recurrence_rate', 'max'),
    max_avg_per_occurrence=('avg_per_occurrence', 'max')
).reset_index()
chronic_counts = chronic_patterns.groupby('junction_name').size().reset_index(name='junction_chronic_count')
junction_chronic = junction_chronic.merge(chronic_counts, on='junction_name', how='left')
junction_chronic['junction_chronic_count'] = junction_chronic['junction_chronic_count'].fillna(0).astype(int)
junction_chronic.to_csv(f"{PROCESSED_DIR}/junction_chronic.csv", index=False)
print(f"  Saved: {PROCESSED_DIR}/junction_chronic.csv")
print(f"\n  Junction chronic statistics:")
print(f"    - Junctions with chronic patterns: {len(junction_chronic[junction_chronic['junction_chronic_count'] > 0])}")
print(f"    - Max recurrence rate: {junction_chronic['junction_recurrence_rate'].max():.2f}")
print(f"    - Mean recurrence rate: {junction_chronic['junction_recurrence_rate'].mean():.2f}")
print("\n[STEP 3] Aggregating to Junction Level...")
junction_counts = df_junctions.groupby('junction_name').size()
max_count = junction_counts.max()
def get_top_violation(viol_lists):
    """Get most common violation type from list of violation lists."""
    all_violations = []
    for vlist in viol_lists:
        all_violations.extend(vlist)
    if not all_violations:
        return "UNKNOWN"
    return Counter(all_violations).most_common(1)[0][0]
def get_dominant_shift(hours):
    """Determine dominant shift based on hour distribution."""
    morning = sum(1 for h in hours if 6 <= h <= 11)
    night = sum(1 for h in hours if 0 <= h <= 5)
    total = len(hours)
    if morning > total * 0.4:
        return "MORNING"
    elif night > total * 0.3:
        return "NIGHT"
    else:
        return "AFTERNOON"
def compute_decay_trend(monthly_counts):
    """Compute trend from monthly violation counts."""
    months_order = ['November', 'December', 'January', 'February', 'March', 'April']
    counts = [monthly_counts.get(m, 0) for m in months_order]
    if sum(counts) == 0:
        return "STABLE"
    x = np.arange(len(counts))
    slope, _, _, _, _ = stats.linregress(x, counts)
    if slope > 50:
        return "INCREASING"
    elif slope < -50:
        return "DECREASING"
    else:
        return "STABLE"
junction_features = []
for junction_name in df_junctions['junction_name'].unique():
    jdf = df_junctions[df_junctions['junction_name'] == junction_name]
    count = len(jdf)
    violation_density = count / max_count
    road_type_score_mean = jdf['road_type_score'].mean()
    rush_hour_conc = jdf['rush_hour_flag'].mean()
    violation_severity_mean = jdf['violation_severity'].mean()
    multi_violation_rate = jdf['multi_violation_flag'].mean()
    center_lat = jdf['latitude'].mean()
    center_lon = jdf['longitude'].mean()
    peak_hour_ist = get_mode(jdf['hour_ist'])
    dominant_shift = get_dominant_shift(jdf['hour_ist'].tolist())
    top_vehicle = get_mode(jdf['vehicle_type'])
    top_violation = get_top_violation(jdf['viol_list'].tolist())
    monthly_counts = jdf['month_name'].value_counts().to_dict()
    decay_trend = compute_decay_trend(monthly_counts)
    junc_chronic = junction_chronic[junction_chronic['junction_name'] == junction_name]
    if len(junc_chronic) > 0:
        junction_recurrence_rate = junc_chronic['junction_recurrence_rate'].values[0]
        junction_chronic_count = junc_chronic['junction_chronic_count'].values[0]
    else:
        junction_recurrence_rate = 0.0
        junction_chronic_count = 0
    junction_features.append({
        'junction_name': junction_name,
        'violation_density': violation_density,
        'road_type_score_mean': road_type_score_mean,
        'rush_hour_conc': rush_hour_conc,
        'violation_severity_mean': violation_severity_mean,
        'multi_violation_rate': multi_violation_rate,
        'junction_recurrence_rate': junction_recurrence_rate,
        'junction_chronic_count': junction_chronic_count,
        'center_lat': center_lat,
        'center_lon': center_lon,
        'total_violations': count,
        'peak_hour_ist': peak_hour_ist,
        'dominant_shift': dominant_shift,
        'top_vehicle': top_vehicle,
        'top_violation': top_violation,
        'monthly_counts': json.dumps(monthly_counts),
        'decay_trend': decay_trend
    })
junction_features_df = pd.DataFrame(junction_features)
print(f"  Aggregated {len(junction_features_df)} junctions")
junction_features_df.to_csv(f"{PROCESSED_DIR}/junction_features.csv", index=False)
print(f"  Saved: {PROCESSED_DIR}/junction_features.csv")
print(f"\n  Junction feature statistics:")
print(f"    - Mean violation_density: {junction_features_df['violation_density'].mean():.3f}")
print(f"    - Mean rush_hour_conc: {junction_features_df['rush_hour_conc'].mean():.3f}")
print(f"    - Mean violation_severity: {junction_features_df['violation_severity_mean'].mean():.3f}")
print(f"    - Mean recurrence_rate: {junction_features_df['junction_recurrence_rate'].mean():.3f}")
print("\n[STEP 4] PCA Analysis...")
pca_feature_cols = [
    'violation_density',
    'road_type_score_mean',
    'rush_hour_conc',
    'violation_severity_mean',
    'multi_violation_rate'
]
feature_cols = pca_feature_cols + [
    'total_violations',
    'junction_chronic_count'
]
for col in feature_cols:
    if col in junction_features_df.columns and junction_features_df[col].isna().any():
        print(f"  Warning: Found NaN in {col}, filling with mean")
        junction_features_df[col] = junction_features_df[col].fillna(junction_features_df[col].mean())
X_pca = junction_features_df[pca_feature_cols].values
print(f"  PCA Input shape: {X_pca.shape}")
print(f"  NaN check: {np.isnan(X_pca).sum()} NaN values")
pca_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('pca', PCA())
])
X_pca_transformed = pca_pipeline.fit_transform(X_pca)
pca = pca_pipeline.named_steps['pca']
explained_variance = pca.explained_variance_ratio_
cumulative_variance = np.cumsum(explained_variance)
print(f"\n  Explained Variance Ratio:")
for i, (ev, cv) in enumerate(zip(explained_variance, cumulative_variance)):
    print(f"    PC{i+1}: {ev:.4f} (cumulative: {cv:.4f})")
print(f"\n  PC Loadings (features driving each component):")
loadings = pd.DataFrame(
    pca.components_.T,
    columns=[f'PC{i+1}' for i in range(len(pca_feature_cols))],
    index=pca_feature_cols
)
print(loadings.round(3).to_string())
pca_results = pd.DataFrame(
    X_pca_transformed,
    columns=[f'PC{i+1}' for i in range(X_pca_transformed.shape[1])]
)
pca_results.insert(0, 'junction_name', junction_features_df['junction_name'].values)
joblib.dump(pca_pipeline, f"{MODELS_DIR}/pca_model.pkl")
pca_results.to_csv(f"{PROCESSED_DIR}/pca_results.csv", index=False)
print(f"\n  Saved: {MODELS_DIR}/pca_model.pkl")
print(f"  Saved: {PROCESSED_DIR}/pca_results.csv")
print("\n[STEP 5] XGBoost Regression...")
X_original = junction_features_df[feature_cols].values
y = junction_features_df['junction_recurrence_rate'].values
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(
    X_original, y, test_size=0.2, random_state=42
)
print(f"  Train set: {len(X_train)} junctions")
print(f"  Test set: {len(X_test)} junctions")
model = xgb.XGBRegressor(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    verbosity=0
)
model.fit(X_train, y_train)
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)
y_pred_all = model.predict(X_original)
r2 = r2_score(y_test, y_pred_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
spearman_corr, spearman_p = spearmanr(y_test, y_pred_test)
print(f"\n  Test Set Metrics:")
print(f"    - R²: {r2:.4f}")
print(f"    - RMSE: {rmse:.4f}")
print(f"    - Spearman correlation: {spearman_corr:.4f} (p={spearman_p:.4e})")
print(f"\n  Feature Importance:")
feature_importance = model.feature_importances_
for feat, imp in sorted(zip(feature_cols, feature_importance), key=lambda x: -x[1]):
    print(f"    {feat}: {imp:.4f}")
impact_raw = y_pred_all
impact_min = impact_raw.min()
impact_max = impact_raw.max()
impact_score = 100 * (impact_raw - impact_min) / (impact_max - impact_min) if impact_max > impact_min else np.full_like(impact_raw, 50)
impact_df = pd.DataFrame({
    'junction_name': junction_features_df['junction_name'],
    'impact_score': impact_score,
    'predicted_recurrence': y_pred_all,
    'actual_recurrence': y
})
joblib.dump(model, f"{MODELS_DIR}/xgboost_model.pkl")
impact_df.to_csv(f"{PROCESSED_DIR}/junction_impact_scores.csv", index=False)
print(f"\n  Saved: {MODELS_DIR}/xgboost_model.pkl")
print(f"  Saved: {PROCESSED_DIR}/junction_impact_scores.csv")
print(f"\n  Impact Score Statistics:")
print(f"    - Mean: {impact_score.mean():.2f}")
print(f"    - Min: {impact_score.min():.2f}")
print(f"    - Max: {impact_score.max():.2f}")
print("\n[STEP 6] DBSCAN Clustering...")
coords = df[['latitude', 'longitude']].values
print(f"  Input: {len(coords):,} coordinate pairs (ALL records, no filtering)")
coords_rad = np.radians(coords)
eps = 100 / 6_371_000  
min_samples = 30
print(f"  DBSCAN parameters: eps={eps:.6f} (~100m), min_samples={min_samples}")
from sklearn.neighbors import NearestNeighbors
SAMPLE_SIZE = 50000
print(f"  Using memory-efficient approach: fitting on {SAMPLE_SIZE:,} sample...")
np.random.seed(42)
sample_idx = np.random.choice(len(coords_rad), SAMPLE_SIZE, replace=False)
sample_coords = coords_rad[sample_idx]
dbscan = DBSCAN(
    eps=eps,
    min_samples=min_samples,
    metric='haversine',
    algorithm='ball_tree',
    n_jobs=1  
)
print("  Fitting DBSCAN on sample...")
sample_labels = dbscan.fit_predict(sample_coords)
core_mask = np.zeros(SAMPLE_SIZE, dtype=bool)
core_mask[dbscan.core_sample_indices_] = True
core_coords = sample_coords[core_mask]
core_labels = sample_labels[core_mask]
print(f"  Found {len(set(sample_labels)) - (1 if -1 in sample_labels else 0)} clusters in sample")
print(f"  Core samples: {len(core_coords):,}")
print("  Assigning all points to clusters...")
if len(core_coords) > 0:
    nn = NearestNeighbors(radius=eps, metric='haversine', algorithm='ball_tree')
    nn.fit(core_coords)
    cluster_labels = np.full(len(coords_rad), -1, dtype=int)
    batch_size = 10000
    for i in range(0, len(coords_rad), batch_size):
        batch_end = min(i + batch_size, len(coords_rad))
        batch_coords = coords_rad[i:batch_end]
        distances, indices = nn.radius_neighbors(batch_coords)
        for j, (dists, idxs) in enumerate(zip(distances, indices)):
            if len(idxs) > 0:
                nearest_idx = idxs[np.argmin(dists)]
                cluster_labels[i + j] = core_labels[nearest_idx]
        if (i + batch_size) % 50000 == 0:
            print(f"    Processed {min(i + batch_size, len(coords_rad)):,} / {len(coords_rad):,} points...")
else:
    cluster_labels = np.full(len(coords_rad), -1, dtype=int)
    print("  Warning: No core samples found, all points are noise")
df['cluster_id'] = cluster_labels
n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
n_noise = sum(cluster_labels == -1)
noise_pct = 100 * n_noise / len(cluster_labels)
print(f"\n  Clustering Results:")
print(f"    - Number of clusters: {n_clusters}")
print(f"    - Noise points: {n_noise:,} ({noise_pct:.1f}%)")
sample_size = min(5000, len(coords_rad))
sample_idx = np.random.choice(len(coords_rad), sample_size, replace=False)
sample_coords = coords_rad[sample_idx]
sample_labels = cluster_labels[sample_idx]
valid_sample_mask = sample_labels != -1
if len(set(sample_labels[valid_sample_mask])) > 1:
    valid_idx = sample_labels != -1
    if sum(valid_idx) > 100:
        silhouette = silhouette_score(sample_coords[valid_idx], sample_labels[valid_idx], metric='haversine')
        print(f"    - Silhouette score (sample): {silhouette:.4f}")
        sample_coords_deg = coords[sample_idx]
        valid_idx_db = sample_labels != -1
        if len(set(sample_labels[valid_idx_db])) > 1:
            db_score = davies_bouldin_score(sample_coords_deg[valid_idx_db], sample_labels[valid_idx_db])
            print(f"    - Davies-Bouldin index (sample): {db_score:.4f}")
print("\n  Computing cluster statistics...")
cluster_data = []
for cluster_id in sorted(set(cluster_labels)):
    if cluster_id == -1:
        continue  
    cluster_mask = df['cluster_id'] == cluster_id
    cluster_df = df[cluster_mask]
    center_lat = cluster_df['latitude'].mean()
    center_lon = cluster_df['longitude'].mean()
    total_violations = len(cluster_df)
    junction_counts = cluster_df[cluster_df['junction_name'] != 'No Junction']['junction_name'].value_counts()
    top_junction = junction_counts.index[0] if len(junction_counts) > 0 else "No Junction"
    all_violations = []
    for vlist in cluster_df['viol_list']:
        all_violations.extend(vlist)
    dominant_violation_type = Counter(all_violations).most_common(1)[0][0] if all_violations else "UNKNOWN"
    dominant_vehicle_type = get_mode(cluster_df['vehicle_type'])
    peak_hour = get_mode(cluster_df['hour_ist'])
    cluster_data.append({
        'cluster_id': cluster_id,
        'center_lat': center_lat,
        'center_lon': center_lon,
        'total_violations': total_violations,
        'top_junction': top_junction,
        'dominant_violation_type': dominant_violation_type,
        'dominant_vehicle_type': dominant_vehicle_type,
        'peak_hour_ist': peak_hour
    })
cluster_df_stats = pd.DataFrame(cluster_data)
print(f"  Computed stats for {len(cluster_df_stats)} clusters")
joblib.dump(dbscan, f"{MODELS_DIR}/dbscan_model.pkl")
cluster_df_stats.to_csv(f"{PROCESSED_DIR}/cluster_data.csv", index=False)
record_clusters = df[['id', 'cluster_id']].copy()
record_clusters.to_csv(f"{PROCESSED_DIR}/record_clusters.csv", index=False)
print(f"\n  Saved: {MODELS_DIR}/dbscan_model.pkl")
print(f"  Saved: {PROCESSED_DIR}/cluster_data.csv")
print(f"  Saved: {PROCESSED_DIR}/record_clusters.csv")
print(f"\n  Top 5 clusters by violation count:")
top_clusters = cluster_df_stats.nlargest(5, 'total_violations')
for _, row in top_clusters.iterrows():
    print(f"    Cluster {row['cluster_id']}: {row['total_violations']:,} violations, peak hour {row['peak_hour_ist']}, {row['top_junction']}")
print("\n" + "=" * 70)
print("PIPELINE COMPLETE")
print("=" * 70)
print("\nOutput Files Created:")
print(f"  Models ({MODELS_DIR}/):")
print(f"    - pca_model.pkl")
print(f"    - xgboost_model.pkl")
print(f"    - dbscan_model.pkl")
print(f"\n  Processed Data ({PROCESSED_DIR}/):")
print(f"    - junction_features.csv ({len(junction_features_df)} rows)")
print(f"    - junction_impact_scores.csv ({len(impact_df)} rows)")
print(f"    - junction_chronic.csv ({len(junction_chronic)} rows)")
print(f"    - chronic_patterns.csv ({len(chronic_patterns)} rows)")
print(f"    - cluster_data.csv ({len(cluster_df_stats)} rows)")
print(f"    - record_clusters.csv ({len(record_clusters):,} rows)")
print(f"    - pca_results.csv ({len(pca_results)} rows)")
print("\nKey Metrics Summary:")
print(f"  - Total records processed: {len(df):,}")
print(f"  - Named junctions: {len(junction_features_df)}")
print(f"  - Chronic patterns found: {len(chronic_patterns)}")
print(f"  - XGBoost R² (test): {r2:.4f}")
print(f"  - XGBoost RMSE (test): {rmse:.4f}")
print(f"  - DBSCAN clusters: {n_clusters}")
print(f"  - Noise points: {noise_pct:.1f}%")
print("\n" + "=" * 70)
