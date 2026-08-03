# Sample Agent CLI

This sample demonstrates the Fortmont agent lifecycle:

1. Register with a join token
2. Keep posting heartbeats
3. Hold an outbound SSE heartbeat stream
4. Unregister on shutdown

## Usage

Generate a token from the dashboard first using Register Agent.

Then run:

```bash
go run ./samples/agent --server-url http://localhost:3000 --token <JOIN_TOKEN>
```

This first run enrolls the agent and stores an encrypted state file with:

- server URL
- device ID
- agent auth token

On subsequent runs, just start the CLI without arguments:

```bash
go run ./samples/agent
```

It reconnects automatically with the persisted agent auth token.

Optional flags:

- `--name sample-agent`
- `--description "Go sample agent"`
- `--device-id sample-node-01`
- `--version 0.1.0`
- `--state-file <path>` to override storage path
- `--reset-state` to delete saved state and force re-enrollment

## Expected Control Plane Behavior

- Agent appears in the Agents table after registration
- Status changes to Connected once SSE heartbeat is open
- Status turns Disconnected shortly after stopping the CLI
