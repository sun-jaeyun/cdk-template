import { CfnOutput, Duration } from 'aws-cdk-lib';
import { DeduplicationScope, FifoThroughputLimit, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import type { Environment } from '@/lib/environment';

export class SqsConstruct extends Construct {
  public readonly dlq: Queue;
  public readonly queue: Queue;

  constructor(scope: Construct, id: string, environment: Environment) {
    super(scope, id);

    // SQS Dead Letter Queue
    this.dlq = new Queue(this, 'Dlq', {
      queueName: `dlq-${environment.env}.fifo`, // 큐 이름
      fifo: true, // FIFO 큐
      visibilityTimeout: Duration.seconds(30), // 표시 제한 시간
      retentionPeriod: Duration.days(4), // 보존 기간
      contentBasedDeduplication: true, // 콘텐츠 기반 중복 제거
      deduplicationScope: DeduplicationScope.MESSAGE_GROUP, // 중복 제거 범위
      fifoThroughputLimit: FifoThroughputLimit.PER_MESSAGE_GROUP_ID, // FIFO 처리량 한도
    });

    // SQS Queue
    this.queue = new Queue(this, 'Queue', {
      queueName: `queue-${environment.env}.fifo`, // 큐 이름
      fifo: true, // FIFO 큐
      visibilityTimeout: Duration.seconds(30), // 표시 제한 시간
      retentionPeriod: Duration.days(1), // 보존 기간
      contentBasedDeduplication: true, // 콘텐츠 기반 중복 제거
      deduplicationScope: DeduplicationScope.MESSAGE_GROUP, // 중복 제거 범위
      fifoThroughputLimit: FifoThroughputLimit.PER_MESSAGE_GROUP_ID, // FIFO 처리량 한도
      deadLetterQueue: {
        queue: this.dlq, // 데드 레터 큐
        maxReceiveCount: 3, // 최대 수신 횟수
      },
    });

    // 출력
    new CfnOutput(this, 'DlqArn', {
      value: this.dlq.queueArn,
      description: 'SQS Dead Letter Queue ARN',
    });

    new CfnOutput(this, 'QueueArn', {
      value: this.queue.queueArn,
      description: 'SQS Queue ARN',
    });

    new CfnOutput(this, 'DlqUrl', {
      value: this.dlq.queueUrl,
      description: 'SQS Dead Letter Queue URL',
    });

    new CfnOutput(this, 'QueueUrl', {
      value: this.queue.queueUrl,
      description: 'SQS Queue URL',
    });
  }
}
