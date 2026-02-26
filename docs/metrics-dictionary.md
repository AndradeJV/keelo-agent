# Metrics Dictionary (V1)

This document defines the source, calculation and confidence for each KPI shown in the role-based metrics area.

## CTO View

- `Riscos críticos/altos`
  - source: `analyses` + `risks`
  - calculation: count of `critical` + `high` risks in selected period
  - confidence: high
- `Bugs escapados para produção`
  - source: `jira_bug_events`
  - calculation: count where `bug_origin = escaped_prod`
  - confidence: high when Jira is configured and syncing; low otherwise
- `PRs analisados`
  - source: `analyses`
  - calculation: count of `type = pr` in period
  - confidence: high

## PM View

- `Bugs pegos antes da produção`
  - source: `jira_bug_events`
  - calculation: count where `bug_origin = caught_pre_prod`
  - confidence: high when Jira labels are configured
- `Fluxos com risco elevado`
  - source: `analyses` + `risks`
  - calculation: number of critical/high risk occurrences in period
  - confidence: high
- `Testes gerados`
  - source: `playwright_suggestions`
  - calculation: count of generated test suggestions in period
  - confidence: medium

## QA View

- `Cobertura média`
  - source: `qa_health.coverage`
  - calculation: current estimated percentage from risk-to-test ratio
  - confidence: medium (proxy metric)
- `Hot spots`
  - source: `risk_hotspots`
  - calculation: number of areas/files in hot spot list
  - confidence: high
- `PRs sem testes`
  - source: `analyses`
  - calculation: PR analyses with `scenarios_count = 0`
  - confidence: high

## Weekly Slack Report

- `Taxa de aceitação dos testes`
  - source: `feedback_entries.tests_added`
  - calculation: accepted/total analyses with generated scenarios
  - confidence: medium (feedback-dependent)
- `Fluxos críticos com cobertura`
  - source: `settings.runtime.criticalFlows` + `test_scenarios`
  - calculation: covered flow names / total configured critical flows
  - confidence: medium (name-match heuristic)

