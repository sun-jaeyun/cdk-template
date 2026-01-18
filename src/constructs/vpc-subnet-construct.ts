import {
  CfnNatGateway,
  GatewayVpcEndpointAwsService,
  IpAddresses,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcSubnetConstruct extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // VPC 생성
    this.vpc = new Vpc(this, 'Vpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'), // IP 대역
      /**
       * 최대 가용 영역(AZ) 수 설정 기준
       *
       * 가용 영역 수를 선택할 때 고려해야 할 주요 사항들:
       *
       * 1. 비용 고려사항
       *    - 각 가용 영역마다 서브넷, NAT Gateway, 로드 밸런서 등 리소스가 생성됨
       *    - NAT Gateway: AZ당 약 $32/월 + 데이터 전송 비용 (Regional NAT Gateway 사용 시 비용 절감 가능)
       *    - 로드 밸런서: AZ당 추가 비용 발생
       *    - 따라서 비용 최적화가 중요하다면 2개 AZ로 시작하는 것을 권장
       *
       * 2. 고가용성 요구사항
       *    - 프로덕션 환경: 최소 2개, 권장 3개 이상의 AZ 사용
       *    - 개발/테스트 환경: 2개 AZ로도 충분 (비용 절감)
       *    - 단일 AZ 장애 시에도 서비스 지속성을 보장하려면 최소 2개 AZ 필수
       *
       * 3. AWS 리전별 제한사항
       *    - 대부분의 리전: 3개 이상의 AZ 제공
       *    - 일부 신규 리전: 2개 AZ만 제공될 수 있음
       *    - 리전의 실제 AZ 수를 확인하고 그에 맞게 설정 필요
       *
       * 4. 애플리케이션 아키텍처
       *    - 마이크로서비스/분산 시스템: 3개 이상 권장 (장애 격리 및 트래픽 분산)
       *    - 단순 웹 애플리케이션: 2개 AZ로도 충분
       *    - 데이터베이스 클러스터: 보통 3개 AZ 사용 (마스터-리플리카 구성)
       *
       * 5. 데이터 복제 및 백업 전략
       *    - RDS Multi-AZ: 최소 2개 AZ 필요
       *    - RDS 클러스터: 3개 이상 권장
       *    - 데이터 일관성 요구사항이 높을수록 더 많은 AZ 필요
       *
       * 6. 트래픽 분산 및 로드 밸런싱
       *    - ALB/NLB: 여러 AZ에 걸쳐 트래픽 분산 가능
       *    - 더 많은 AZ = 더 나은 트래픽 분산 및 장애 복구 능력
       *
       * 권장 설정:
       *    - 개발/테스트: maxAzs: 2 (비용 절감)
       *    - 프로덕션: maxAzs: 3 (고가용성과 비용의 균형)
       *    - 엔터프라이즈/크리티컬: maxAzs: 3 이상 (최대 가용성)
       *
       * 참고: Regional NAT Gateway를 사용하는 경우, NAT Gateway가 AZ에 종속되지 않으므로
       *       여러 AZ를 사용해도 NAT Gateway 비용은 1개만 발생
       */
      maxAzs: 3,
      /**
       * NAT Gateway 개수 설정 기준
       *
       * NAT Gateway 개수를 선택할 때 고려해야 할 주요 사항들:
       *
       * 1. 비용 비교 분석
       *    - NAT Gateway 비용: 약 $32/월 (시간당 $0.045) + 데이터 전송 비용 ($0.045/GB)
       *    - AZ 간 데이터 전송 비용: 같은 리전 내 AZ 간 전송 시 $0.01/GB
       *    - 예시: 3개 AZ 환경에서 NAT Gateway 1개 사용 시
       *            * NAT Gateway 비용: $32/월 (고정)
       *            * AZ 간 통신 비용: 다른 AZ의 프라이빗 서브넷에서 NAT Gateway가 있는 AZ로 트래픽 전송 시 발생
       *            * 트래픽이 적은 경우: NAT Gateway 1개 + AZ 간 통신 비용 < NAT Gateway 3개 비용
       *
       * 2. 트래픽 패턴에 따른 선택 기준
       *    - 아웃바운드 트래픽이 적은 경우 (예: 개발/테스트 환경, 소규모 프로덕션)
       *      → NAT Gateway 1개 + AZ 간 통신 비용 부담이 더 경제적일 수 있음
       *    - 아웃바운드 트래픽이 많은 경우 (예: 대용량 데이터 처리, 스트리밍)
       *      → 각 AZ에 NAT Gateway 배치하여 AZ 간 통신 비용 절감
       *    - 월간 아웃바운드 트래픽이 약 700GB 이상인 경우: NAT Gateway 다중화 고려
       *      (계산: $32 / $0.045 ≈ 711GB, 이 이상이면 AZ 간 통신 비용이 NAT Gateway 비용보다 높아질 수 있음)
       *
       * 3. 고가용성 요구사항
       *    - NAT Gateway 1개: 단일 장애점(SPOF) 존재, 해당 AZ 장애 시 모든 아웃바운드 트래픽 차단
       *    - NAT Gateway 다중화: 각 AZ에 배치 시 AZ 장애 격리, 고가용성 보장
       *    - 프로덕션 환경: 비용이 허용되면 NAT Gateway 다중화 권장
       *    - 개발/테스트 환경: NAT Gateway 1개로도 충분 (비용 절감)
       *
       * 4. 네트워크 성능 및 지연시간
       *    - NAT Gateway 1개: 다른 AZ의 인스턴스는 AZ 간 통신을 통해 NAT Gateway 접근
       *      → 추가 네트워크 홉으로 인한 지연시간 증가 (보통 1-2ms)
       *    - NAT Gateway 다중화: 각 AZ 내 인스턴스는 동일 AZ의 NAT Gateway 사용
       *      → 지연시간 최소화, 성능 최적화
       *    - 실시간 애플리케이션이나 낮은 지연시간이 중요한 경우: NAT Gateway 다중화 고려
       *
       * 5. Regional NAT Gateway 옵션
       *    - AWS에서 제공하는 Regional NAT Gateway는 AZ에 종속되지 않음
       *    - 단일 Regional NAT Gateway로 여러 AZ의 트래픽 처리 가능
       *    - 비용: $32/월 (고정) + 데이터 전송 비용 (AZ 간 통신 비용 없음)
       *    - 고가용성: AWS가 자동으로 여러 AZ에 걸쳐 관리
       *    - 현재 코드에서 주석 처리된 부분을 활성화하면 Regional NAT Gateway 사용 가능
       *
       * 6. 권장 설정 전략
       *    - 개발/테스트 환경: natGateways: 1 (비용 절감, AZ 간 통신 비용 부담)
       *    - 소규모 프로덕션 (트래픽 < 500GB/월): natGateways: 1 (AZ 간 통신 비용 부담)
       *    - 중규모 프로덕션 (트래픽 500-1000GB/월): natGateways: maxAzs (고가용성 + 성능)
       *    - 대규모 프로덕션 (트래픽 > 1000GB/월): natGateways: maxAzs 필수
       *    - Regional NAT Gateway 사용 가능 시: natGateways: 1 + Regional 모드 활성화 (최적 선택)
       *
       * 7. 비용 최적화 팁
       *    - VPC 엔드포인트(S3, DynamoDB 등) 활용: NAT Gateway를 거치지 않고 직접 접근
       *      → 아웃바운드 트래픽 감소 → NAT Gateway 비용 절감
       *    - 트래픽 모니터링: CloudWatch로 실제 트래픽 패턴 분석 후 결정
       *    - 단계적 접근: 처음에는 1개로 시작하고, 트래픽 증가 시 확장
       *
       * 결론: 트래픽이 적고 비용 최적화가 중요한 경우, NAT Gateway 개수를 줄이고
       *       AZ 간 통신 비용을 부담하는 것이 전체적으로 더 경제적일 수 있습니다.
       *       하지만 고가용성과 성능이 중요한 프로덕션 환경에서는 NAT Gateway 다중화를 권장합니다.
       */
      natGateways: 1,
      /**
       * 서브넷 구성 (Subnet Configuration)
       *
       * 세 가지 유형의 서브넷을 구성하는 이유:
       *
       * 1. PUBLIC 서브넷 (SubnetType.PUBLIC)
       *    - 목적: 인터넷 게이트웨이를 통해 인터넷에 직접 접근 가능한 서브넷
       *    - 특징:
       *      * 인바운드/아웃바운드 인터넷 트래픽 모두 허용
       *      * 공인 IP 주소를 가진 리소스 배치 가능
       *    - 사용 사례:
       *      * Application Load Balancer (ALB), Network Load Balancer (NLB)
       *      * Bastion 호스트 (SSH 접근용 점프 서버)
       *      * NAT Gateway (다른 서브넷의 아웃바운드 트래픽 처리)
       *      * 인터넷에 직접 노출되어야 하는 웹 서버
       *    - 보안 고려사항: 공개적으로 접근 가능하므로 강력한 보안 그룹 규칙 필수
       *
       * 2. PRIVATE 서브넷 (SubnetType.PRIVATE_WITH_EGRESS)
       *    - 목적: NAT Gateway를 통해서만 아웃바운드 인터넷 접근이 가능한 서브넷
       *    - 특징:
       *      * 인바운드 인터넷 트래픽 차단 (보안 강화)
       *      * 아웃바운드 인터넷 트래픽은 NAT Gateway를 통해 가능
       *      * 인터넷 게이트웨이에 직접 라우팅되지 않음
       *    - 사용 사례:
       *      * 애플리케이션 서버 (EC2, ECS, EKS 워커 노드)
       *      * 일반적인 데이터베이스 (RDS, ElastiCache)
       *      * 패키지 업데이트나 외부 API 호출이 필요한 서비스
       *      * 인터넷에서 직접 접근할 필요는 없지만 업데이트/모니터링을 위해 아웃바운드 접근이 필요한 리소스
       *    - 보안 고려사항: 인바운드 트래픽이 차단되어 있어 상대적으로 안전하지만, 아웃바운드 트래픽은 모니터링 필요
       *
       * 3. ISOLATED 서브넷 (SubnetType.PRIVATE_ISOLATED)
       *    - 목적: 인터넷 접근이 완전히 차단된 최고 보안 수준의 서브넷
       *    - 특징:
       *      * 인바운드/아웃바운드 인터넷 트래픽 모두 차단
       *      * VPC 내부 리소스와만 통신 가능
       *      * VPC 엔드포인트(S3, DynamoDB 등)를 통한 AWS 서비스 접근은 가능
       *    - 사용 사례:
       *      * 민감한 데이터베이스 (고객 정보, 결제 정보 등)
       *      * 백업 저장소 (인터넷 접근 불필요)
       *      * 내부 전용 마이크로서비스 (다른 VPC 리소스와만 통신)
       *      * 규정 준수 요구사항이 엄격한 데이터 (GDPR, PCI-DSS 등)
       *    - 보안 고려사항: 최고 수준의 보안이 필요한 리소스에 적합, 하지만 업데이트/모니터링 시 VPC 엔드포인트 활용 필요
       *
       * 4. 아키텍처 설계 원칙
       *    - Defense in Depth (다층 방어): 여러 보안 계층을 통해 공격 표면 축소
       *    - 최소 권한 원칙: 각 리소스는 필요한 최소한의 네트워크 접근만 허용
       *    - 네트워크 분리: 서비스 유형에 따라 적절한 서브넷에 배치하여 보안 격리
       *    - 비용 최적화: PUBLIC 서브넷은 최소화하고, 대부분의 리소스를 PRIVATE/ISOLATED에 배치
       *
       * 5. CIDR 마스크 설정 (cidrMask: 20)
       *    - /20 서브넷 = 4,096개의 IP 주소 (2^12)
       *    - VPC CIDR이 /16 (10.0.0.0/16)인 경우:
       *      * 각 서브넷: /20 = 4,096 IP 주소
       *      * 3개 서브넷 타입 × 3개 AZ = 9개 서브넷
       *      * 총 사용 IP: 9 × 4,096 = 36,864개 (VPC의 약 56%)
       *    - 충분한 IP 주소 확보: 향후 확장성 고려
       *
       * 6. 권장 배치 전략
       *    - PUBLIC: ALB, NLB, Bastion 호스트만 배치 (최소화)
       *    - PRIVATE: 대부분의 애플리케이션 서버 및 일반 데이터베이스 배치
       *    - ISOLATED: 민감한 데이터베이스 및 백업 저장소만 배치 (최소화)
       */
      subnetConfiguration: [
        { cidrMask: 20, name: 'subnet-public', subnetType: SubnetType.PUBLIC }, // 퍼블릭 서브넷
        { cidrMask: 20, name: 'subnet-private', subnetType: SubnetType.PRIVATE_WITH_EGRESS }, // 프라이빗 서브넷
        { cidrMask: 20, name: 'subnet-isolated', subnetType: SubnetType.PRIVATE_ISOLATED }, // 격리된 프라이빗 서브넷
      ],
    });

    /**
     * Regional NAT Gateway 설정
     *
     * Regional NAT Gateway의 장점:
     * 1. 비용 절감
     *    - 여러 AZ에 걸쳐 단일 NAT Gateway로 사용 가능하여 NAT Gateway 비용이 1개만 발생 ($32/월)
     *    - AZ 간 데이터 전송 비용이 발생하지 않음 (같은 NAT Gateway를 공유하므로)
     *    - 예: 3개 AZ 환경에서 일반 NAT Gateway 3개 사용 시 $96/월 → Regional NAT Gateway 1개 사용 시 $32/월
     *
     * 2. 고가용성
     *    - AWS가 자동으로 여러 AZ에 걸쳐 관리하여 단일 AZ 장애에 대한 복원력 제공
     *    - 단일 AZ 장애 시에도 다른 AZ의 트래픽 처리가 가능
     *
     * 3. 관리 용이성
     *    - 단일 NAT Gateway로 관리하므로 운영 부담 감소
     *    - 라우팅 테이블 설정이 단순화됨
     *
     * Regional NAT Gateway의 단점:
     * 1. CDK 지원 제한
     *    - 현재 CDK에서 완전히 지원되지 않아 CloudFormation 레벨에서 직접 설정 필요
     *    - 아래 주석 처리된 코드를 사용하여 CfnNatGateway의 속성을 직접 오버라이드해야 함
     *
     * 2. 성능 제한 가능성
     *    - 단일 NAT Gateway를 여러 AZ가 공유하므로 트래픽이 많을 경우 병목 현상 발생 가능
     *    - 대용량 트래픽 환경에서는 각 AZ에 NAT Gateway를 배치하는 것이 더 나을 수 있음
     *
     * 3. 제어 제한
     *    - 특정 AZ에 배치할 수 없어 세밀한 네트워크 구성에 제약이 있음
     *    - AZ별 트래픽 분리나 특정 AZ 우선순위 설정이 어려움
     *
     * 4. 리전 지원 제한
     *    - 모든 AWS 리전에서 사용 가능하지 않을 수 있음 (리전별 지원 여부 확인 필요)
     *
     * 사용 권장 시나리오:
     *    - 개발/테스트 환경: 비용 절감이 중요한 경우
     *    - 소규모 프로덕션: 트래픽이 적고 비용 최적화가 중요한 경우
     *    - 중소규모 워크로드: 월간 아웃바운드 트래픽이 500GB 미만인 경우
     *
     * 사용 비권장 시나리오:
     *    - 대용량 트래픽 환경: 월간 아웃바운드 트래픽이 1TB 이상인 경우
     *    - 낮은 지연시간 요구: 실시간 애플리케이션이나 낮은 지연시간이 중요한 경우
     *    - 엔터프라이즈 환경: 최대 성능과 제어가 필요한 경우
     *
     * NOTE: CDK에서 Regional NAT Gateway 지원 전까지 아래 주석 해제하여 사용
     */
    // this.vpc.node.findAll().forEach((child) => {
    //   if (child instanceof CfnNatGateway) {
    //     child.addPropertyOverride('AvailabilityMode', 'regional');
    //     child.addPropertyOverride('VpcId', this.vpc.vpcId);
    //     child.addPropertyDeletionOverride('SubnetId');
    //   }
    // });

    /**
     * S3 및 DynamoDB 게이트웨이 엔드포인트 설정
     *
     * 게이트웨이 엔드포인트를 설정하는 주요 이유:
     * 1. 비용 절감: NAT Gateway를 거치지 않고 AWS 백본 네트워크를 통해 직접 접근하여
     *    데이터 전송 비용 및 NAT Gateway 비용 절감 (게이트웨이 엔드포인트는 무료)
     * 2. 보안 강화: 인터넷을 거치지 않고 프라이빗 네트워크를 통해 접근하여 보안성 향상
     * 3. 성능 향상: NAT Gateway를 우회하여 지연시간 감소 및 처리량 향상
     * 4. 프라이빗 서브넷 접근: 인터넷 게이트웨이 없이도 프라이빗 서브넷에서 S3/DynamoDB 접근 가능
     */
    // S3 게이트웨이 엔드포인트
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
    });

    // DynamoDB 게이트웨이 엔드포인트
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: GatewayVpcEndpointAwsService.DYNAMODB,
    });
  }
}
