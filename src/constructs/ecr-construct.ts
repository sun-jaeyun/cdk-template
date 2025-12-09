import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Repository, TagMutability, TagStatus } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcrConstruct extends Construct {
  public readonly backendRepository: Repository;
  public readonly frontendRepository: Repository;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Backend ECR 리포지토리
    this.backendRepository = new Repository(this, 'BackendRepository', {
      repositoryName: 'backend-repository', // 리포지토리 이름
      imageTagMutability: TagMutability.MUTABLE, // 이미지 태그 수정 가능 여부
      removalPolicy: RemovalPolicy.RETAIN, // 삭제 정책
      // 수명 주기 규칙
      lifecycleRules: [
        {
          rulePriority: 10,
          maxImageCount: 100,
          tagPatternList: ['production-*'],
        },
        {
          rulePriority: 20,
          maxImageCount: 10,
          tagPatternList: ['staging-*'],
        },
        {
          rulePriority: 30,
          maxImageAge: Duration.days(14),
          tagStatus: TagStatus.ANY,
        },
      ],
    });

    // Frontend ECR 리포지토리
    this.frontendRepository = new Repository(this, 'FrontendRepository', {
      repositoryName: 'frontend-repository', // 리포지토리 이름
      imageTagMutability: TagMutability.MUTABLE, // 이미지 태그 수정 가능 여부
      removalPolicy: RemovalPolicy.RETAIN, // 삭제 정책
      // 수명 주기 규칙
      lifecycleRules: [
        {
          rulePriority: 10,
          maxImageCount: 100,
          tagPatternList: ['production-*'],
        },
        {
          rulePriority: 20,
          maxImageCount: 10,
          tagPatternList: ['staging-*'],
        },
        {
          rulePriority: 30,
          maxImageAge: Duration.days(14),
          tagStatus: TagStatus.ANY,
        },
      ],
    });
  }
}
