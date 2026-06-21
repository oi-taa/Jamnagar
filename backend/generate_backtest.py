"""
Generate backtest data from April holdout
Pairs actual violation counts with Prophet predictions for best clusters
"""

import pandas as pd
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
PROCESSED = os.path.join(BASE, 'data', 'processed')

# Load raw violation data
print("Loading raw violation data...")
df = pd.read_csv('C:/Users/ADMIN/Downloads/flip_hack/jan to may police violation_anonymized791b166.csv')
print(f"Total records: {len(df)}")

# Parse dates with mixed format
df['datetime'] = pd.to_datetime(df['created_datetime'], format='mixed', utc=True)
df['date'] = df['datetime'].dt.date

# Filter to April 2024 (holdout period)
df_april = df[(df['datetime'].dt.month == 4) & (df['datetime'].dt.year == 2024)]
print(f"April 2024 records: {len(df_april)}")
print(f"April date range: {df_april['date'].min()} to {df_april['date'].max()}")

# Load cluster data to map junctions to clusters
cluster_data = pd.read_csv(f'{PROCESSED}/cluster_data.csv')
print(f"\nClusters: {len(cluster_data)}")

# Load Prophet forecasts
with open(f'{PROCESSED}/prophet_forecasts.json') as f:
    forecasts = json.load(f)

# Load Prophet metrics
with open(f'{PROCESSED}/prophet_metrics.json') as f:
    metrics = json.load(f)

# Create junction to cluster mapping
junction_to_cluster = {}
for _, row in cluster_data.iterrows():
    junction_to_cluster[row['top_junction']] = int(row['cluster_id'])

# Best clusters to process (from PROPHET_BEST_CLUSTERS)
best_clusters = {
    12: {"junction": "BTP082 - KR Market Junction", "mape": 23.2},
    15: {"junction": "Unknown", "mape": 39.1},
    7: {"junction": "BTP027 - Modi Bridge Junction", "mape": 39.8},
}

# For each best cluster, compute daily actuals
backtest_data = {}

for cluster_id, info in best_clusters.items():
    cluster_id_str = str(cluster_id)
    print(f"\nProcessing cluster {cluster_id}...")

    # Get junction names for this cluster
    cluster_junctions = cluster_data[cluster_data['cluster_id'] == cluster_id]['top_junction'].values
    print(f"  Junction: {cluster_junctions}")

    if len(cluster_junctions) == 0:
        continue

    junction_name = cluster_junctions[0]

    # Get forecast for this cluster
    if cluster_id_str not in forecasts:
        print(f"  No forecast for cluster {cluster_id}")
        continue

    forecast_list = forecasts[cluster_id_str]

    # Filter April violations for this junction
    df_cluster = df_april[df_april['junction_name'] == junction_name]

    if len(df_cluster) == 0:
        # Try partial match
        df_cluster = df_april[df_april['junction_name'].str.contains(junction_name.split(' - ')[-1] if ' - ' in junction_name else junction_name, case=False, na=False)]

    print(f"  April violations for junction: {len(df_cluster)}")

    # Aggregate by date
    daily_counts = df_cluster.groupby('date').size().reset_index(name='actual')
    daily_counts['date'] = daily_counts['date'].astype(str)

    # Match with predictions
    points = []
    for fc in forecast_list:
        fc_date = fc['ds'][:10]  # Get YYYY-MM-DD
        predicted = round(fc['yhat'])

        # Find actual for this date
        actual_row = daily_counts[daily_counts['date'] == fc_date]
        actual = int(actual_row['actual'].values[0]) if len(actual_row) > 0 else 0

        points.append({
            "date": fc_date,
            "actual": actual,
            "predicted": predicted
        })

    # Compute MAPE for this cluster
    actuals = [p['actual'] for p in points if p['actual'] > 0]
    preds = [p['predicted'] for p in points if p['actual'] > 0]

    if len(actuals) > 0:
        mape = sum(abs(a - p) / a * 100 for a, p in zip(actuals, preds)) / len(actuals)
    else:
        mape = metrics.get(cluster_id_str, {}).get('mape', 0)

    backtest_data[cluster_id_str] = {
        "cluster_id": cluster_id,
        "junction_name": junction_name,
        "mape": round(mape, 1),
        "points": points
    }

    print(f"  Generated {len(points)} backtest points, MAPE: {round(mape, 1)}%")

# Save backtest data
output_path = f'{PROCESSED}/backtest_data.json'
with open(output_path, 'w') as f:
    json.dump(backtest_data, f, indent=2)

print(f"\nBacktest data saved to {output_path}")
print(json.dumps(backtest_data, indent=2))
