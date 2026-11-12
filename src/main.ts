import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './console/core';
import './console/pwa';
import './console/embed';

// the self-hosted console (npm run build:console) runs on another site: it sends nothing to this site's analytics
if (import.meta.env.PUBLIC_PGD_CONSOLE_BUILD !== '1') {
  // Vercel Web Analytics: page views plus the custom events sent through track() (see README)
  inject();
  // Vercel Speed Insights: real user monitoring for performance metrics
  injectSpeedInsights();
}
