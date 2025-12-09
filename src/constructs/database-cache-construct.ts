import { CfnOutput, Duration, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnServerlessCache } from 'aws-cdk-lib/aws-elasticache';
import {
  Credentials,
  DatabaseInsightsMode,
  DatabaseInstance,
  DatabaseInstanceEngine,
  ParameterGroup,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface DatabaseCacheConstructProps {
  vpc: Vpc;
  databaseSg: SecurityGroup;
  cacheSg: SecurityGroup;
}

export class DatabaseCacheConstruct extends Construct {
  public readonly database: DatabaseInstance;
  public readonly cache: CfnServerlessCache;

  constructor(scope: Construct, id: string, props: DatabaseCacheConstructProps) {
    super(scope, id);

    // Database 파라미터 그룹
    const parameterGroup = new ParameterGroup(this, 'ParameterGroup', {
      engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_18 }),
      parameters: {
        log_min_duration_statement: '500',
        shared_preload_libraries: 'pg_stat_statements,pg_cron',
      },
    });

    // Database
    this.database = new DatabaseInstance(this, 'Database', {
      engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_18_1 }), // 엔진
      vpc: props.vpc, // VPC
      vpcSubnets: { subnets: props.vpc.isolatedSubnets }, // 격리된 프라이빗 서브넷
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.SMALL), // 인스턴스 타입
      // 데이터베이스 자격 증명
      credentials: Credentials.fromPassword(
        'postgres',
        // TODO: 실제 값 추가
        SecretValue.ssmSecure('/database/password' as const),
      ),
      securityGroups: [props.databaseSg], // 데이터베이스 보안그룹
      allocatedStorage: 20, // 스토리지 용량 (GB)
      maxAllocatedStorage: 1000, // 최대 스토리지 용량 (GB)
      storageType: StorageType.GP3, // 스토리지 유형
      publiclyAccessible: false, // 공개 접근 여부
      multiAz: true, // 다중 가용 영역 활성화
      storageEncrypted: true, // 스토리지 암호화 여부
      deletionProtection: true, // 삭제 보호 여부
      removalPolicy: RemovalPolicy.SNAPSHOT, // 삭제 정책
      autoMinorVersionUpgrade: true, // 마이너 버전 자동 업그레이드 활성화
      databaseInsightsMode: DatabaseInsightsMode.STANDARD, // 데이터베이스 인사이트 모드
      monitoringInterval: Duration.seconds(60), // 모니터링 간격
      cloudwatchLogsExports: ['postgresql'], // 로그 내보내기
      backupRetention: Duration.days(7), // 백업 보존 기간
      preferredBackupWindow: '15:00-16:00', // 백업 기간 (UTC)
      copyTagsToSnapshot: true, // 스냅샷에 태그 복사 여부
      preferredMaintenanceWindow: 'sun:18:00-sun:19:00', // 유지 관리 기간 (UTC)
      parameterGroup, // 파라미터 그룹
    });

    // ElastiCache
    this.cache = new CfnServerlessCache(this, 'Cache', {
      serverlessCacheName: 'valkey-cache',
      engine: 'valkey', // 엔진
      majorEngineVersion: '8', // 버전
      subnetIds: props.vpc.isolatedSubnets.map((subnet) => subnet.subnetId), // 서브넷
      securityGroupIds: [props.cacheSg.securityGroupId], // 보안그룹
      snapshotRetentionLimit: 1, // 스냅샷 보존 기간 (일)
    });

    // 출력
    new CfnOutput(this, 'DatabaseArn', {
      value: this.database.instanceArn,
      description: 'Database ARN',
    });

    new CfnOutput(this, 'DatabaseHost', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'Database Host',
    });

    new CfnOutput(this, 'DatabasePort', {
      value: this.database.dbInstanceEndpointPort,
      description: 'Database Port',
    });

    new CfnOutput(this, 'CacheArn', {
      value: this.cache.attrArn,
      description: 'Cache ARN',
    });

    new CfnOutput(this, 'CacheHost', {
      value: this.cache.attrEndpointAddress,
      description: 'Cache Host',
    });

    new CfnOutput(this, 'CachePort', {
      value: this.cache.attrEndpointPort,
      description: 'Cache Port',
    });
  }
}
