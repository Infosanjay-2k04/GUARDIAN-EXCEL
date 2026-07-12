Guardian Excel — AI-Powered Multi-Tiered Safety System

Guardian Excel is an AI-powered safety system designed for predictive monitoring and real-time threat detection across multiple safety tiers. This repository holds the mobile app (Expo/React Native), monitoring utilities, and a Streamlit dashboard for live visualization.

What It Does
- Predictive monitoring and threat detection
- Multi-tier escalation and notifications
- Mobile application (Expo) and web dashboard

Repository Layout
- `GuardianApp/` — Expo app, components, and assets
- `streamlit_dashboard.py` — Streamlit dashboard entrypoint
- `hub.py` — project utilities
- `live_data.json`, `location_history.json` — sample datasets

Quick Start
1. Install Node dependencies (inside `GuardianApp`):

```
cd GuardianApp
npm install
```

2. Start the Expo app:

```
cd GuardianApp
npm start
# or
# expo start
```

3. Run the Streamlit dashboard (optional):

```
pip install streamlit
streamlit run streamlit_dashboard.py
```

License
This project uses the MIT License. See `LICENSE` for details.

Contributing
See `CONTRIBUTING.md` for contribution guidelines and `CODE_OF_CONDUCT.md` for community expectations.
