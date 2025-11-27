# Supabase 데이터베이스 읽기 전용 문제 해결 가이드

## 🔍 문제 진단

현재 DATABASE_URL:
```
postgresql://postgres:teams_namos0419@db.drifsxbtlkulgapaokno.supabase.co:5432/postgres
```

이 연결 문자열은 **직접 연결** (포트 5432)을 사용하므로 정상적으로 쓰기 권한이 있어야 합니다.

## ✅ Supabase 대시보드에서 확인할 사항

### 1. 프로젝트 상태 확인
1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
2. 프로젝트 `drifsxbtlkulgapaokno` 선택
3. **Settings** → **General** 확인
   - 프로젝트가 **Active** 상태인지 확인
   - 프로젝트가 일시 중지되었거나 제한 모드인지 확인

### 2. 데이터베이스 연결 설정 확인
1. **Settings** → **Database** → **Connection string** 확인
2. **Connection pooling** 섹션 확인:
   - **Session mode** (포트 6543): 읽기/쓰기 가능
   - **Transaction mode** (포트 6543): 읽기 전용
   - **Direct connection** (포트 5432): 전체 권한 ✅ 현재 사용 중

### 3. 데이터베이스 사용자 권한 확인
1. **Database** → **Roles** 확인
2. `postgres` 사용자 권한 확인:
   - `LOGIN` 권한이 있는지 확인
   - `CREATEDB` 권한이 있는지 확인
   - `CREATEROLE` 권한이 있는지 확인

### 4. RLS (Row Level Security) 정책 확인
**참고**: Prisma는 직접 PostgreSQL 연결을 사용하므로 RLS는 영향을 주지 않아야 합니다. 하지만 확인해보세요.

1. **Database** → **Tables** → 각 테이블 확인
2. RLS가 활성화되어 있는지 확인
3. 필요한 경우 RLS 정책 확인:
   ```sql
   -- 예: characters 테이블의 RLS 정책 확인
   SELECT * FROM pg_policies WHERE tablename = 'characters';
   ```

### 5. 데이터베이스 연결 테스트

**먼저 실제 컬럼 이름 확인:**
```sql
-- characters 테이블의 컬럼 이름 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'characters'
ORDER BY ordinal_position;
```

**올바른 INSERT 쿼리 (컬럼 이름 확인 후):**
```sql
-- Prisma는 camelCase를 snake_case로 변환하므로:
-- safetyFilter → safety_filter
-- systemTemplate → system_template
-- firstSituation → first_situation
-- firstMessage → first_message
-- detailSetting → detail_setting
-- createdAt → created_at
-- updatedAt → updated_at

-- 올바른 INSERT 쿼리:
INSERT INTO characters (name, description, author_id, visibility, "safetyFilter")
VALUES ('Test Character', 'Test Description', 1, 'public', true)
RETURNING id;

-- 또는 따옴표 없이 (Prisma가 snake_case로 변환했다면):
INSERT INTO characters (name, description, author_id, visibility, safety_filter)
VALUES ('Test Character', 'Test Description', 1, 'public', true)
RETURNING id;
```

**참고**: PostgreSQL에서:
- 따옴표 없는 식별자: 자동으로 소문자로 변환 (`safetyFilter` → `safetyfilter`)
- 따옴표 있는 식별자: 대소문자 구분 (`"safetyFilter"` → `safetyFilter`)

이 쿼리가 실패하면:
- 데이터베이스 사용자 권한 문제
- 테이블 권한 문제
- RLS 정책 문제

## 🔧 해결 방법

### 방법 1: Connection Pooler 사용 (권장하지 않음)
현재 직접 연결을 사용하고 있으므로 이 방법은 필요 없습니다.

### 방법 2: 데이터베이스 사용자 권한 확인
Supabase 대시보드에서 `postgres` 사용자 권한을 확인하고 필요한 권한을 부여하세요.

### 방법 3: 새로운 데이터베이스 사용자 생성
1. **Database** → **Roles** → **New role**
2. 새 사용자 생성 (예: `app_user`)
3. 필요한 권한 부여:
   ```sql
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
   ```
4. `.env.local`의 DATABASE_URL 업데이트

### 방법 4: Supabase 프로젝트 재시작
프로젝트가 일시 중지된 경우:
1. **Settings** → **General** → **Restart project**

## 📝 추가 확인 사항

### 서버 로그 확인
실제 에러 메시지를 확인하세요:
- Prisma 에러 코드 (예: `P2002`, `P2003`)
- PostgreSQL 에러 메시지
- 권한 관련 에러 메시지

### 네트워크/방화벽 확인
- Supabase 데이터베이스에 대한 네트워크 접근이 차단되지 않았는지 확인
- IP 화이트리스트 설정 확인 (Supabase는 기본적으로 모든 IP 허용)

## 🚨 즉시 확인할 사항

1. **Supabase 대시보드** → **Database** → **Logs** 확인
   - 최근 데이터베이스 에러 로그 확인
   - 권한 관련 에러 메시지 확인

2. **서버 콘솔 로그** 확인
   - `[POST] エラー名:` 확인
   - `[POST] エラーメッセージ:` 확인
   - Prisma 에러 코드 확인

3. **SQL Editor에서 직접 테스트**
   ```sql
   -- 읽기 테스트
   SELECT COUNT(*) FROM characters;
   
   -- 쓰기 테스트
   INSERT INTO characters (name, description, author_id, visibility, safetyFilter)
   VALUES ('Test', 'Test', 1, 'public', true);
   ```

## 📞 Supabase 지원

위의 방법으로 해결되지 않으면:
1. Supabase 대시보드 → **Support** → **Contact support**
2. 에러 메시지와 함께 문의

