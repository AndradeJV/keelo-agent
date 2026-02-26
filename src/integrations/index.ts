/**
 * Integrations Module
 * 
 * External service integrations:
 * - GitHub (webhooks, API, Git operations)
 * - Slack (notifications)
 * - Figma (design fetching)
 */

export * as github from './github/index.js';
export * as slack from './slack/index.js';
export * as figma from './figma/index.js';

