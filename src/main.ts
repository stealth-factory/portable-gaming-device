import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './console/core';
import './console/pwa';
import './console/embed';

// Vercel Web Analytics: page views plus the custom events sent through track() (see README)
inject();

// Vercel Speed Insights: real user monitoring for performance metrics
injectSpeedInsights();
