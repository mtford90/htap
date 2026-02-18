# Configuration

[Back to README](../README.md)

Create `.procsi/config.json` to override defaults. All fields are optional:

```json
{
  "maxStoredRequests": 5000,
  "maxBodySize": 10485760,
  "maxLogSize": 10485760,
  "pollInterval": 2000
}
```

| Setting             | Default            | Description                                                           |
| ------------------- | ------------------ | --------------------------------------------------------------------- |
| `maxStoredRequests` | `5000`             | Max requests in the database. Oldest evicted automatically.           |
| `maxBodySize`       | `10485760` (10 MB) | Max body size to capture. Larger bodies are proxied but not stored.   |
| `maxLogSize`        | `10485760` (10 MB) | Max log file size before rotation.                                    |
| `pollInterval`      | `2000`             | TUI polling interval in ms. Lower = faster updates, more IPC traffic. |

Missing or invalid values fall back to defaults.
