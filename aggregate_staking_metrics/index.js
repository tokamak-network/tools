#!/usr/bin/env node
/**
 * Basic Staking Metrics Aggregator - Main Entry Point
 */

const calculateMetrics = require('./calculate_metrics');

// 메인 실행
if (require.main === module) {
  calculateMetrics.main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = calculateMetrics;

