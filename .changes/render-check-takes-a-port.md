`doctor --render` takes `--port`, so the check can be steered off a port something else is holding.

The check starts its own `dev` on the first free port from 5181 and had no way to be told otherwise. That is fine alone and bad in company: run it while another project's catalog is on that range and the two contend for the same port. Observed — a run that collided with another catalog on 5182 reported **257 errors**, every one `ERR_CONNECTION_REFUSED`, naming this project's pages for a server that was never this project's.

```
ds-viewer doctor --render --port 5190
```

A port that cannot be a port is refused rather than ignored. Silently falling back to a self-chosen port is how the 257-error run happened in the first place: a check that renders against something other than what you pointed it at reports another server's pages as your failures.

What this does *not* fix, and is worth knowing: `waitForServer` accepts **any** HTTP reply on the port as proof the catalog is up — its own comment says so. A stranger's server still satisfies it. The flag lets you avoid the collision; it does not let the check notice one. Telling the two apart needs its own change.
