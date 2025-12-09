#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { FoundationStack } from '@/stacks/foundation-stack';

const app = new App();

// 기반 스택 생성
const foundationStack = new FoundationStack(app, 'FoundationStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  stackName: 'foundation-stack',
});
