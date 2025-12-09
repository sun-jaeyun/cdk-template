#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { productionEnvironment, stagingEnvironment } from '@/lib/environment';
import { ApplicationStack } from '@/stacks/application-stack';
import { FoundationStack } from '@/stacks/foundation-stack';

const app = new App();

// 기반 스택 생성
const foundationStack = new FoundationStack(app, 'FoundationStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  stackName: 'foundation-stack',
});

// 스테이징 스택 생성
new ApplicationStack(
  app,
  'ApplicationStagingStack',
  {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    stackName: 'application-staging-stack',
  },
  stagingEnvironment, // 스테이징 환경 변수
  foundationStack,
);

// 프로덕션 스택 생성
new ApplicationStack(
  app,
  'ApplicationProductionStack',
  {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    stackName: 'application-production-stack',
  },
  productionEnvironment, // 프로덕션 환경 변수
  foundationStack,
);
