import { TimeZone } from 'aws-cdk-lib';
import { Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { Schedule, ScheduleExpression, ScheduleTargetInput } from 'aws-cdk-lib/aws-scheduler';
import { SqsSendMessage } from 'aws-cdk-lib/aws-scheduler-targets';
import { Construct } from 'constructs';

import type { Environment } from '@/lib/environment';
import type { Queue } from 'aws-cdk-lib/aws-sqs';

interface EventBridgeConstructProps {
  queue: Queue;
}

export class EventBridgeConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    environment: Environment,
    props: EventBridgeConstructProps,
  ) {
    super(scope, id);

    // 오래된 인증들 삭제
    // new Schedule(this, 'DeleteOldVerifications', {
    //   scheduleName: `schedule-${environment.env}-delete-old-verifications`, // 스케줄 이름
    //   schedule: ScheduleExpression.cron({
    //     timeZone: TimeZone.ASIA_SEOUL, // 서울 시간
    //     minute: '0', // 매일 0분
    //     hour: '1', // 매일 1시
    //   }),
    //   target: new SqsSendMessage(props.queue, {
    //     messageGroupId: 'deleteOldVerifications', // 메시지 그룹 ID
    //     input: ScheduleTargetInput.fromText(
    //       JSON.stringify({
    //         createdAt: '<aws.scheduler.scheduled-time>',
    //       }),
    //     ), // 입력
    //   }),
    // });

    // MediaConvert 작업 상태 변경 이벤트 규칙
    // new Rule(this, 'MediaConvertJobStateChange', {
    //   ruleName: `rule-${environment.env}-media-convert-job-state-change`, // 규칙 이름
    //   eventPattern: {
    //     source: ['aws.mediaconvert'], // 이벤트 소스
    //     detailType: ['MediaConvert Job State Change'], // 이벤트 상세 유형
    //   },
    //   targets: [
    //     new SqsQueue(props.queue, {
    //       messageGroupId: 'mediaConvertJobStateChange', // 메시지 그룹 ID
    //       message: RuleTargetInput.fromText(
    //         JSON.stringify({
    //           createdAt: '<$.time>',
    //           jobId: '<$.detail.jobId>',
    //           status: '<$.detail.status>',
    //           outputGroupDetails: '<$.detail.outputGroupDetails>',
    //         }),
    //       ),
    //     }),
    //   ],
    // });
  }
}
