import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  ApiMapping,
  DomainName,
  HttpApi,
  HttpMethod,
  IpAddressType,
  type VpcLink,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpAlbIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { type SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2';
import type { Repository } from 'aws-cdk-lib/aws-ecr';
import {
  AlternateTarget,
  type Cluster,
  ContainerImage,
  CpuArchitecture,
  DeploymentControllerType,
  DeploymentStrategy,
  EnvironmentFile,
  FargateService,
  FargateTaskDefinition,
  ListenerRuleConfiguration,
  LogDriver,
  OperatingSystemFamily,
  Protocol,
  Secret,
} from 'aws-cdk-lib/aws-ecs';
import {
  type ApplicationListener,
  ApplicationListenerRule,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerCondition,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AaaaRecord, ARecord, type IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties, LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import type { Environment } from '@/lib/environment';

interface BackendApplicationConstructProps {
  vpc: Vpc;
  sg: SecurityGroup;
  lbSg: SecurityGroup;
  cluster: Cluster;
  repository: Repository;
  vpcLink: VpcLink;
  hostedZone: IHostedZone;
  privateHostedZone: IHostedZone;
  certificate: ICertificate;
}

export class BackendApplicationConstruct extends Construct {
  public readonly taskDef: FargateTaskDefinition;
  public readonly service: FargateService;
  public readonly productionListener: ApplicationListener;
  public readonly testListener: ApplicationListener;
  public readonly apiGateway: HttpApi;

  constructor(
    scope: Construct,
    id: string,
    environment: Environment,
    props: BackendApplicationConstructProps,
  ) {
    super(scope, id);

    // Backend ECS 태스크 실행 역할
    const taskExecutionRole = new Role(this, 'BackendTaskExecutionRole', {
      roleName: `backend-ecs-execution-role-${environment.env}`, // 역할 이름
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com' as const), // 신뢰 관계
      // AWS 관리 정책
      managedPolicies: [
        // ECS 태스크 실행 역할 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'AmazonECSTaskExecutionRolePolicy',
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy' as const,
        ),
        // S3 읽기 전용 접근 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'AmazonS3ReadOnlyAccess',
          'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess' as const,
        ),
      ],
    });

    // Backend ECS 태스크 역할
    const taskRole = new Role(this, 'BackendTaskRole', {
      roleName: `backend-ecs-task-role-${environment.env}`, // 역할 이름
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com' as const), // 신뢰 관계
      // 인라인 정책
      inlinePolicies: {},
      // AWS 관리 정책
      managedPolicies: [
        // SQS 전체 접근 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'AmazonSQSFullAccess',
          'arn:aws:iam::aws:policy/AmazonSQSFullAccess' as const,
        ),
        // S3 전체 접근 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'AmazonS3FullAccess',
          'arn:aws:iam::aws:policy/AmazonS3FullAccess' as const,
        ),
        // CloudFront 전체 접근 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'CloudFrontFullAccess',
          'arn:aws:iam::aws:policy/CloudFrontFullAccess' as const,
        ),
      ],
    });

    // Backend 태스크 정의
    this.taskDef = new FargateTaskDefinition(this, 'BackendTaskDef', {
      family: `backend-task-def-${environment.env}`,
      cpu: environment.backendCpu, // ECS CPU
      memoryLimitMiB: environment.backendMemory, // ECS 메모리
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.X86_64, // 아키텍처
        operatingSystemFamily: OperatingSystemFamily.LINUX, // 운영 체제
      },
      taskRole: taskRole, // 태스크 역할
      executionRole: taskExecutionRole, // 태스크 실행 역할
    });

    // Backend CloudWatch Logs 그룹
    const logGroup = new LogGroup(this, 'BackendLogGroup', {
      logGroupName: `/ecs/backend-${environment.env}`,
      retention: RetentionDays.ONE_MONTH, // 보존 기간
      removalPolicy: RemovalPolicy.DESTROY, // 제거 정책
    });

    // 컨테이너 추가
    this.taskDef.addContainer(environment.containerName, {
      image: ContainerImage.fromEcrRepository(props.repository, `${environment.env}-latest`), // 이미지
      portMappings: [{ containerPort: environment.containerPort, protocol: Protocol.TCP }], // 포트 매핑
      // 환경 변수
      environmentFiles: [
        EnvironmentFile.fromBucket(
          Bucket.fromBucketArn(this, 'EnvironmentFile', environment.envBucketArn),
          environment.backendEnvPath,
        ),
      ],
      // 시크릿
      secrets: {
        // NOTE: CloudFront Signed URL 사용 시 주석 해제
        // CF_PRIVATE_KEY: Secret.fromSsmParameter(
        //   StringParameter.fromSecureStringParameterAttributes(this, 'PrivateKey', {
        //     // TODO: 실제 값 추가
        //     parameterName: '/private-key' as const,
        //   }),
        // ),
      },
      // 로깅
      logging: LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'ecs', // 스트림 접두사
      }),
    });

    // Backend ECS 서비스
    this.service = new FargateService(this, 'BackendService', {
      cluster: props.cluster, // 클러스터
      taskDefinition: this.taskDef, // 태스크 정의
      serviceName: `backend-service-${environment.env}`,
      desiredCount: environment.backendDesiredCount, // 원하는 수
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS }, // 서브넷
      securityGroups: [props.sg], // 보안 그룹
      // 용량 공급자 전략
      capacityProviderStrategies: [
        { capacityProvider: 'FARGATE', weight: 1 },
        { capacityProvider: 'FARGATE_SPOT', weight: 3 },
      ],
      assignPublicIp: false, // 퍼블릭 IP 할당 여부
      minHealthyPercent: 100, // 최소 가용성
      maxHealthyPercent: 200, // 최대 가용성
      deploymentController: { type: DeploymentControllerType.ECS }, // 배포 컨트롤러
      deploymentStrategy: DeploymentStrategy.BLUE_GREEN, // 배포 전략
      // 배포 서킷 브레이커
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
      // 배포 알람
      deploymentAlarms: {
        alarmNames: [`backend-alarm-${environment.env}`],
      },
      bakeTime: Duration.minutes(2), // 블루/그린 트래픽 전환 대기 시간
      healthCheckGracePeriod: Duration.seconds(30), // 헬스 체크 유예 기간
    });

    // Backend ALB
    const alb = new ApplicationLoadBalancer(this, 'BackendAlb', {
      vpc: props.vpc, // VPC
      internetFacing: false, // 인터넷 연결 여부
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS }, // 서브넷
      securityGroup: props.lbSg, // 보안 그룹
    });

    // Backend Blue 대상 그룹
    const blueTargetGroup = new ApplicationTargetGroup(this, 'BackendBlueTargetGroup', {
      vpc: props.vpc,
      port: environment.containerPort, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      targetType: TargetType.IP, // 대상 타입
      healthCheck: {
        path: '/health', // 헬스 체크 경로
        interval: Duration.seconds(30), // 헬스 체크 간격
        timeout: Duration.seconds(5), // 헬스 체크 타임아웃
        healthyThresholdCount: 2, // 가용 임계값
        unhealthyThresholdCount: 2, // 불가용 임계값
      },
      deregistrationDelay: Duration.seconds(30), // 등록 취소 지연 시간
    });

    // Backend Green 대상 그룹
    const greenTargetGroup = new ApplicationTargetGroup(this, 'BackendGreenTargetGroup', {
      vpc: props.vpc, // VPC
      port: environment.containerPort, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      targetType: TargetType.IP, // 대상 타입
      healthCheck: {
        path: '/health', // 헬스 체크 경로
        interval: Duration.seconds(30), // 헬스 체크 간격
        timeout: Duration.seconds(5), // 헬스 체크 타임아웃
        healthyThresholdCount: 2, // 정상 임계값
        unhealthyThresholdCount: 2, // 비정상 임계값
      },
      deregistrationDelay: Duration.seconds(30), // 등록 취소 지연 시간
    });

    // Backend 프로덕션 리스너 추가
    this.productionListener = alb.addListener('BackendProductionListener', {
      port: 80, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      defaultTargetGroups: [blueTargetGroup], // 대상 그룹
    });

    // Backend 프로덕션 리스너 규칙 추가
    const productionListenerRule = new ApplicationListenerRule(
      this,
      'BackendProductionListenerRule',
      {
        listener: this.productionListener, // 리스너
        priority: 1, // 우선순위
        conditions: [ListenerCondition.pathPatterns(['/*'])], // 조건
        targetGroups: [blueTargetGroup], // 대상 그룹
      },
    );

    // Backend 테스트 리스너 추가
    this.testListener = alb.addListener('BackendTestListener', {
      port: 8080, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      defaultTargetGroups: [greenTargetGroup], // 대상 그룹
    });

    // Backend 테스트 리스너 규칙 추가
    const testListenerRule = new ApplicationListenerRule(this, 'BackendTestListenerRule', {
      listener: this.testListener, // 리스너
      priority: 1, // 우선순위
      conditions: [ListenerCondition.httpHeader('X-Environment', ['test'])], // 조건
      targetGroups: [greenTargetGroup], // 대상 그룹
    });

    // Backend 로드 밸런서 역할
    const loadBalancerRole = new Role(this, 'BackendLoadBalancerRole', {
      roleName: `backend-ecs-load-balancer-role-${environment.env}`, // 역할 이름
      assumedBy: new ServicePrincipal('ecs.amazonaws.com' as const), // 신뢰 관계
      // AWS 관리 정책
      managedPolicies: [
        // ECS Blue/Green 배포를 위한 로드밸런서 정책
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'AmazonECSInfrastructureRolePolicyForLoadBalancers',
          'arn:aws:iam::aws:policy/AmazonECSInfrastructureRolePolicyForLoadBalancers' as const,
        ),
      ],
    });

    // Backend 로드밸런서 대상
    const serviceTarget = this.service.loadBalancerTarget({
      containerName: environment.containerName, // 컨테이너 이름
      containerPort: environment.containerPort, // 컨테이너 포트
      alternateTarget: new AlternateTarget('BackendAlternateTarget', {
        alternateTargetGroup: greenTargetGroup, // 대체 대상 그룹
        role: loadBalancerRole, // 로드 밸런서 역할
        productionListener:
          ListenerRuleConfiguration.applicationListenerRule(productionListenerRule), // 프로덕션 리스너 규칙
        testListener: ListenerRuleConfiguration.applicationListenerRule(testListenerRule), // 테스트 리스너 규칙
      }),
    });

    // Blue 대상 그룹에 대상 연결
    serviceTarget.attachToApplicationTargetGroup(blueTargetGroup);

    // 오토 스케일링
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1, // 최소 수
      maxCapacity: 4, // 최대 수
    });

    // CPU 사용량 기반 스케일링 - 70%
    scaling.scaleOnCpuUtilization('BackendCpuScaling', {
      targetUtilizationPercent: 70, // 목표 사용량 퍼센트
      scaleInCooldown: Duration.seconds(60), // 스케일 인 쿨다운
      scaleOutCooldown: Duration.seconds(60),
    });

    // 메모리 사용량 기반 스케일링 - 80%
    scaling.scaleOnMemoryUtilization('BackendMemoryScaling', {
      targetUtilizationPercent: 80, // 목표 사용량 퍼센트
      scaleInCooldown: Duration.seconds(60), // 스케일 인 쿨다운
      scaleOutCooldown: Duration.seconds(60), // 스케일 아웃 쿨다운
    });

    // ALB Private 영역 A 레코드 추가
    new ARecord(this, 'BackendARecord', {
      zone: props.privateHostedZone, // 호스팅 영역
      recordName: environment.backendDomain, // 도메인 이름
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
    });

    // API Gateway 생성
    this.apiGateway = new HttpApi(this, 'ApiGateway', {
      ipAddressType: IpAddressType.IPV4, // IP 주소 타입
    });

    // ALB 통합
    const albIntegration = new HttpAlbIntegration('AlbIntegration', this.productionListener, {
      vpcLink: props.vpcLink, // VPC Link
    });

    // API Gateway 경로 추가 - /v1/webhook/{proxy+}
    this.apiGateway.addRoutes({
      integration: albIntegration, // ALB 통합
      path: '/v1/webhooks/{proxy+}', // 경로
      methods: [HttpMethod.ANY], // 메소드
    });

    // API Gateway 커스텀 도메인
    const domainName = new DomainName(this, 'ApiGatewayDomainName', {
      domainName: environment.apiGatewayDomain, // 도메인 이름
      certificate: props.certificate, // ACM 인증서
    });

    // API Gateway Public 영역 A 레코드 추가
    new ARecord(this, 'ApiGatewayARecord', {
      zone: props.hostedZone, // 호스팅 영역
      recordName: environment.apiGatewayDomain, // 도메인 이름
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId,
        ),
      ),
    });

    // API Gateway Public 영역 AAAA 레코드 추가
    new AaaaRecord(this, 'ApiGatewayAaaaRecord', {
      zone: props.hostedZone, // 호스팅 영역
      recordName: environment.apiGatewayDomain, // 도메인 이름
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId,
        ),
      ),
    });

    // API Gateway에 도메인 매핑
    new ApiMapping(this, 'ApiMapping', {
      api: this.apiGateway, // API Gateway
      domainName, // 도메인 이름
    });

    // 출력
    new CfnOutput(this, 'BackendTaskDefArn', {
      value: this.taskDef.taskDefinitionArn,
      description: 'ECS Task Definition ARN',
    });

    new CfnOutput(this, 'BackendCpu', {
      value: this.taskDef.cpu.toString(),
      description: 'ECS CPU',
    });

    new CfnOutput(this, 'BackendMemory', {
      value: this.taskDef.memoryMiB.toString(),
      description: 'ECS Memory',
    });

    new CfnOutput(this, 'BackendServiceName', {
      value: this.service.serviceName,
      description: 'ECS Service Name',
    });

    new CfnOutput(this, 'BackendServiceArn', {
      value: this.service.serviceArn,
      description: 'ECS Service ARN',
    });

    new CfnOutput(this, 'BackendAlbArn', {
      value: alb.loadBalancerArn,
      description: 'ALB ARN',
    });

    new CfnOutput(this, 'BackendAlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new CfnOutput(this, 'BackendDomainName', {
      value: environment.backendDomain,
      description: 'Backend Domain',
    });

    new CfnOutput(this, 'ApiGatewayId', {
      value: this.apiGateway.apiId,
      description: 'API Gateway ID',
    });
  }
}
