# CDK TypeScript 템플릿

이것은 AWS에 확장 가능하고 현대적인 웹 애플리케이션을 배포하기 위해 설계된 TypeScript 기반 CDK 프로젝트 템플릿입니다.

## 프로젝트 구조

소스 코드는 `src` 디렉토리 내에서 다음과 같이 구성됩니다:

-   `src/bin/cdk-template.ts`: CDK 애플리케이션의 진입점입니다. 프로젝트의 여러 스택을 인스턴스화합니다.
-   `src/lib/environment.ts`: 환경별 구성을 포함하여 개발, 스테이징, 프로덕션 환경에 대해 다른 설정을 허용합니다.
-   `src/stacks`: 기본 CDK 스택을 포함합니다.
    -   `foundation-stack.ts`: VPC 및 서브넷과 같은 기반 리소스를 정의합니다.
    -   `application-stack.ts`: ECS 클러스터, 서비스, 태스크, 파이프라인과 같은 애플리케이션별 리소스를 정의합니다.
-   `src/constructs`: 특정 AWS 리소스 생성을 캡슐화하는 재사용 가능한 CDK 구문(construct)을 포함합니다. 이는 코드 재사용성과 관심사 분리를 촉진합니다. 구문은 다음을 포함합니다:
    -   `vpc-subnet-construct.ts`: VPC 및 서브넷 생성용.
    -   `security-group-construct.ts`: 보안 그룹 관리용.
    -   `ecr-construct.ts`: ECR 리포지토리 생성용.
    -   `ecs-cluster-construct.ts`: ECS 클러스터 설정용.
    -   `database-cache-construct.ts`: 데이터베이스 및 캐싱 계층(예: RDS, ElastiCache)용.
    -   `sqs-construct.ts`: SQS 대기열 생성용.
    -   `eventbridge-construct.ts`: EventBridge 규칙 및 버스 설정용.
    -   `backend-application-construct.ts`: ECS에 백엔드 서비스 배포용.
    -   `frontend-application-construct.ts`: 프론트엔드 애플리케이션 배포용.
    -   `s3-cloudfront-construct.ts`: S3 버킷 및 CloudFront 배포 설정용.
    -   `route53-acm-construct.ts`: Route 53 레코드 및 ACM 인증서 관리용.
    -   `vpc-link-construct.ts`: API Gateway용 VPC 링크 생성용.

## 사전 준비 사항

이 스택을 배포하기 전에 AWS 계정에 다음 리소스가 생성되어 있어야 합니다:

-   **Route 53 호스팅 영역**: 사용하려는 도메인에 대한 공개 호스팅 영역.
-   **ACM 인증서**: `us-east-1` 리전의 도메인에 대한 SSL/TLS 인증서. 인증서는 `ISSUED` 상태여야 하며 사용하려는 도메인 및 모든 하위 도메인을 포함해야 합니다.

## 유용한 명령어

-   `pnpm install`: 의존성 설치.
-   `pnpm run format`: 모든 소스 및 테스트 파일의 코드 형식을 지정합니다.
-   `pnpm run lint`: 모든 소스 및 테스트 파일의 린트 오류를 찾아 수정합니다.
-   `pnpm run typecheck`: 타입스크립트 타입 오류를 확인합니다.
-   `pnpm run bootstrap`: CDK 배포를 위한 환경을 준비합니다.
-   `pnpm run deploy`: 스택을 기본 AWS 계정/리전에 배포합니다.
-   `pnpm run diff`: 배포된 스택과 현재 상태를 비교합니다.
-   `pnpm run destroy`: 스택의 리소스를 삭제합니다.
-   `pnpm run synth`: 합성된 CloudFormation 템플릿을 출력합니다.
