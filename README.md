# campbell-chain-collector

A quick attempt at a collector script for [Chain
API](https://github.com/ResEnv/chain-api) that pulls from the web interface on
Campbell Scientific dataloggers (e.g. CR1000).

## Usage

Copy `config.json.example` to `config.json` and edit with your Chain
credentials, datalogger URLs and tables, and desired target Chain devices and
update schedules (use `cron` notation).  Run `node main.js`.
