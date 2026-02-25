# send-coupon-sms

쿠폰 **발행** / **사용 완료** 시 고객 전화번호로 SMS를 보내는 Edge Function입니다.  
**국내 SOLAPI(구 CoolSMS)** 연동이며, 발송 문구는 DB `sms_templates` 테이블에서 관리자가 수정·선택한 템플릿을 사용합니다.

## 배포

```bash
npx supabase login
npx supabase link --project-ref 본인프로젝트ref
npx supabase functions deploy send-coupon-sms
```

## 시크릿 (Supabase 대시보드 → Edge Functions → Secrets)

| Name | 설명 |
|------|------|
| `SOLAPI_API_KEY` | SOLAPI 콘솔에서 발급한 API Key |
| `SOLAPI_API_SECRET` | SOLAPI API Secret |
| `SOLAPI_FROM_NUMBER` | 발신번호 (숫자만, 예: 01012345678) — 사전 등록 필수 |
| `SUPABASE_URL` | 프로젝트 URL (자동 설정되는 경우 있음) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 롤 키 (템플릿 조회용) |

SOLAPI 발급: [솔라피 콘솔](https://console.solapi.com/) → API Key 관리.

## 요청 형식

POST body (JSON):

- **발행 시** (type: issue):  
  `type`, `phone`, `couponCode`, `discountLabel`, `headcountLabel`, `issuedBranch`

- **사용 완료 시** (type: verify):  
  `type`, `phone`, `couponCode`, `verifiedBranch`, `verifiedAt`, (선택) `discountLabel`, `headcountLabel`

템플릿 치환문구:  
`{{couponCode}}`, `{{discountLabel}}`, `{{headcountLabel}}`, `{{issuedBranch}}`, `{{customerPhone}}`, `{{verifiedBranch}}`, `{{verifiedAt}}`
