import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
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
} from 'aws-cdk-lib/aws-ecs';
import {
  type ApplicationListener,
  ApplicationListenerRule,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  ListenerCondition,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AaaaRecord, ARecord, type IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { Environment } from '@/lib/environment';

interface FrontendApplicationConstructProps {
  vpc: Vpc;
  sg: SecurityGroup;
  lbSg: SecurityGroup;
  cluster: Cluster;
  repository: Repository;
  hostedZone: IHostedZone;
  certificate: ICertificate;
}

export class FrontendApplicationConstruct extends Construct {
  public readonly taskDef: FargateTaskDefinition;
  public readonly service: FargateService;
  public readonly productionListener: ApplicationListener;
  public readonly testListener: ApplicationListener;

  constructor(
    scope: Construct,
    id: string,
    environment: Environment,
    props: FrontendApplicationConstructProps,
  ) {
    super(scope, id);

    // Frontend ECS 태스크 실행 역할
    const taskExecutionRole = new Role(this, 'FrontendTaskExecutionRole', {
      roleName: `frontend-ecs-execution-role-${environment.env}`, // 역할 이름
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

    // Frontend ECS 태스크 역할
    const taskRole = new Role(this, 'FrontendTaskRole', {
      roleName: `frontend-ecs-task-role-${environment.env}`, // 역할 이름
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com' as const), // 신뢰 관계
    });

    // Frontend 태스크 정의
    this.taskDef = new FargateTaskDefinition(this, 'FrontendTaskDef', {
      family: `frontend-task-def-${environment.env}`,
      cpu: environment.frontendCpu, // ECS CPU
      memoryLimitMiB: environment.frontendMemory, // ECS 메모리
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.X86_64, // 아키텍처
        operatingSystemFamily: OperatingSystemFamily.LINUX, // 운영 체제
      },
      taskRole: taskRole, // 태스크 역할
      executionRole: taskExecutionRole, // 태스크 실행 역할
    });

    // Frontend CloudWatch Logs 그룹
    const logGroup = new LogGroup(this, 'FrontendLogGroup', {
      logGroupName: `/ecs/frontend-${environment.env}`,
      retention: RetentionDays.ONE_MONTH, // 보존 기간
      removalPolicy: RemovalPolicy.DESTROY, // 제거 정책
    });

    // 컨테이너 추가
    this.taskDef.addContainer(environment.containerName, {
      image: ContainerImage.fromEcrRepository(props.repository, `${environment.env}-latest`), // 이미지
      portMappings: [{ containerPort: environment.containerPort, protocol: Protocol.TCP }], // 포트 매핑
      // 환경 변수
      environment: {
        TZ: 'Asia/Seoul',
      },
      // 환경 변수 파일
      environmentFiles: [
        EnvironmentFile.fromBucket(
          Bucket.fromBucketArn(this, 'EnvironmentFile', environment.envBucketArn),
          environment.frontendEnvPath,
        ),
      ],
      // 로깅
      logging: LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'ecs', // 스트림 접두사
      }),
    });

    // Frontend ECS 서비스
    this.service = new FargateService(this, 'FrontendService', {
      cluster: props.cluster, // 클러스터
      taskDefinition: this.taskDef, // 태스크 정의
      serviceName: `frontend-service-${environment.env}`,
      desiredCount: environment.frontendDesiredCount, // 원하는 수
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
        alarmNames: [`frontend-alarm-${environment.env}`],
      },
      bakeTime: Duration.minutes(2), // 블루/그린 트래픽 전환 대기 시간
      healthCheckGracePeriod: Duration.seconds(30), // 헬스 체크 유예 기간
    });

    // Frontend ALB
    const alb = new ApplicationLoadBalancer(this, 'FrontendAlb', {
      vpc: props.vpc, // VPC
      internetFacing: true, // 인터넷 연결 여부
      vpcSubnets: { subnetType: SubnetType.PUBLIC }, // 서브넷
      securityGroup: props.lbSg, // 보안 그룹
    });

    // Frontend Blue 대상 그룹
    const blueTargetGroup = new ApplicationTargetGroup(this, 'FrontendBlueTargetGroup', {
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

    // Frontend Green 대상 그룹
    const greenTargetGroup = new ApplicationTargetGroup(this, 'FrontendGreenTargetGroup', {
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

    // HTTP 리다이렉트 액션
    alb.addListener('FrontendHttpRedirectListener', {
      port: 80, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      // 기본 작업
      defaultAction: ListenerAction.redirect({
        protocol: ApplicationProtocol.HTTPS, // 프로토콜
        port: '443', // 포트
        permanent: true, // 영구 이동
      }),
    });

    // Frontend 프로덕션 리스너 추가
    this.productionListener = alb.addListener('FrontendProductionListener', {
      port: 443, // 포트
      protocol: ApplicationProtocol.HTTPS, // 프로토콜
      defaultTargetGroups: [blueTargetGroup], // 기본 대상 그룹
      certificates: [props.certificate], // 인증서
    });

    // Frontend 프로덕션 리스너 규칙 추가
    const productionListenerRule = new ApplicationListenerRule(
      this,
      'FrontendProductionListenerRule',
      {
        listener: this.productionListener, // 리스너
        priority: 1, // 우선순위
        conditions: [ListenerCondition.pathPatterns(['/*'])], // 조건
        targetGroups: [blueTargetGroup], // 대상 그룹
      },
    );

    // Frontend 테스트 리스너 추가
    this.testListener = alb.addListener('FrontendTestListener', {
      port: 8080, // 포트
      protocol: ApplicationProtocol.HTTP, // 프로토콜
      defaultTargetGroups: [greenTargetGroup], // 대상 그룹
    });

    // Frontend 테스트 리스너 규칙 추가
    const testListenerRule = new ApplicationListenerRule(this, 'FrontendTestListenerRule', {
      listener: this.testListener, // 리스너
      priority: 1, // 우선순위
      conditions: [ListenerCondition.httpHeader('X-Environment', ['test'])], // 조건
      targetGroups: [greenTargetGroup], // 대상 그룹
    });

    // Frontend 로드 밸런서 역할
    const loadBalancerRole = new Role(this, 'FrontendLoadBalancerRole', {
      roleName: `frontend-ecs-load-balancer-role-${environment.env}`, // 역할 이름
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

    // Frontend 로드밸런서 대상
    const serviceTarget = this.service.loadBalancerTarget({
      containerName: environment.containerName, // 컨테이너 이름
      containerPort: environment.containerPort, // 컨테이너 포트
      alternateTarget: new AlternateTarget('FrontendAlternateTarget', {
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
    scaling.scaleOnCpuUtilization('FrontendCpuScaling', {
      targetUtilizationPercent: 70, // 목표 사용량 퍼센트
      scaleInCooldown: Duration.seconds(60), // 스케일 인 쿨다운
      scaleOutCooldown: Duration.seconds(60),
    });

    // 메모리 사용량 기반 스케일링 - 80%
    scaling.scaleOnMemoryUtilization('FrontendMemoryScaling', {
      targetUtilizationPercent: 80, // 목표 사용량 퍼센트
      scaleInCooldown: Duration.seconds(60), // 스케일 인 쿨다운
      scaleOutCooldown: Duration.seconds(60), // 스케일 아웃 쿨다운
    });

    // Public 영역 A 레코드 추가
    new ARecord(this, 'FrontendARecord', {
      zone: props.hostedZone, // 호스팅 영역
      recordName: environment.frontendDomain, // 도메인 이름
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
    });

    // Public 영역 AAAA 레코드 추가
    new AaaaRecord(this, 'FrontendAaaaRecord', {
      zone: props.hostedZone, // 호스팅 영역
      recordName: environment.frontendDomain, // 도메인 이름
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
    });

    // 출력
    new CfnOutput(this, 'FrontendTaskDefArn', {
      value: this.taskDef.taskDefinitionArn,
      description: 'ECS Task Definition ARN',
    });

    new CfnOutput(this, 'FrontendCpu', {
      value: this.taskDef.cpu.toString(),
      description: 'ECS CPU',
    });

    new CfnOutput(this, 'FrontendMemory', {
      value: this.taskDef.memoryMiB.toString(),
      description: 'ECS Memory',
    });

    new CfnOutput(this, 'FrontendServiceName', {
      value: this.service.serviceName,
      description: 'ECS Service Name',
    });

    new CfnOutput(this, 'FrontendServiceArn', {
      value: this.service.serviceArn,
      description: 'ECS Service ARN',
    });

    new CfnOutput(this, 'FrontendAlbArn', {
      value: alb.loadBalancerArn,
      description: 'ALB ARN',
    });

    new CfnOutput(this, 'FrontendAlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new CfnOutput(this, 'FrontendDomainName', {
      value: environment.frontendDomain,
      description: 'Frontend Domain',
    });
  }
}
