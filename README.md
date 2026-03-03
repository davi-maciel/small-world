# Small World

Visualizes connections between Brazilian students who participated in international physics olympiads (IPhO, EuPhO, OIbF). Two students are connected if they competed in the same olympiad in the same year.

**https://smallworld.ipho.com.br/**

## Features

- **Participations** — searchable table of all participations, filterable by olympiad and year
- **Degrees of separation** — finds the shortest path between two students via BFS
- **Graph explorer** — interactive force-directed graph visualization

## Development

```bash
npm install
npm run dev          # dev server
npm run build        # static export
npm run data:refresh # re-scrape + rebuild graph
```
