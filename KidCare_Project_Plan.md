# KidCare — Child Care Management System

## 1. Tổng quan dự án

**KidCare** là hệ thống quản lý và chăm sóc trẻ em, hướng tới việc quản lý tập trung thông tin trẻ, phụ huynh, giáo viên, lớp học, điểm danh, sức khỏe, hoạt động và thông báo.

Mục tiêu của project:

- Đáp ứng yêu cầu của môn **Nhập môn Công nghệ phần mềm**.
- Có đủ nghiệp vụ để thực hành:
  - Requirement Engineering
  - Use Case
  - UML
  - Database Design
  - Architecture Design
  - Testing
  - Deployment
- Có kiến trúc đủ tốt để sau này mở rộng và sử dụng lại cho môn **Thiết kế hệ thống (System Design)**.
- Ban đầu ưu tiên **Modular Monolith**, không triển khai Microservices quá sớm.

---

# 2. Bài toán

Một trường/cơ sở chăm sóc trẻ có nhiều trẻ em, phụ huynh, giáo viên và nhân viên.

Các vấn đề cần giải quyết:

- Thông tin trẻ được lưu trữ rời rạc.
- Giáo viên điểm danh thủ công.
- Phụ huynh khó theo dõi tình trạng của trẻ.
- Hồ sơ sức khỏe khó quản lý tập trung.
- Hoạt động của trẻ khó chia sẻ với phụ huynh.
- Thông báo giữa nhà trường và phụ huynh không tập trung.
- Việc quản lý người được phép đón trẻ cần có xác thực và ghi nhận lịch sử.

KidCare cung cấp một hệ thống tập trung để quản lý toàn bộ vòng đời chăm sóc trẻ.

---

# 3. Actors

## 3.1. Parent — Phụ huynh

Chức năng:

- Đăng nhập / đăng xuất.
- Quản lý thông tin cá nhân.
- Quản lý thông tin con.
- Xem điểm danh.
- Xem hồ sơ sức khỏe.
- Xem hoạt động của trẻ.
- Nhận thông báo.
- Gửi yêu cầu nghỉ học.
- Đăng ký người đón trẻ.

## 3.2. Teacher — Giáo viên

Chức năng:

- Xem danh sách trẻ trong lớp.
- Điểm danh.
- Ghi nhận thời gian đến / về.
- Ghi nhận hoạt động.
- Đánh giá tình trạng trẻ.
- Tạo hoạt động.
- Gửi thông báo cho phụ huynh.

## 3.3. Medical Staff — Nhân viên y tế

Chức năng:

- Quản lý hồ sơ sức khỏe.
- Ghi nhận lần khám.
- Ghi nhận chiều cao / cân nặng.
- Quản lý dị ứng.
- Quản lý bệnh nền.
- Quản lý lịch sử thuốc.
- Quản lý tiêm chủng.

## 3.4. Manager — Quản lý cơ sở

Chức năng:

- Quản lý lớp.
- Quản lý giáo viên.
- Quản lý trẻ.
- Phân công giáo viên.
- Xem báo cáo.
- Quản lý hoạt động của cơ sở.

## 3.5. Admin

Chức năng:

- Quản lý tài khoản.
- Quản lý role / permission.
- Quản lý hệ thống.
- Xem audit log.
- Thực hiện các thao tác quản trị.

---

# 4. Các module chính

```text
KidCare
│
├── Authentication & Authorization
├── User Management
├── Child Management
├── Parent Management
├── Class Management
├── Attendance Management
├── Health Management
├── Activity Management
├── Pickup Management
├── Notification Management
└── Reporting
```

---

# 5. Module Authentication & Authorization

Các chức năng cơ bản:

- Register
- Login
- Logout
- Refresh Token
- Password management
- Role-Based Access Control (RBAC)
- Permission checking

Các role:

```text
ADMIN
MANAGER
TEACHER
MEDICAL_STAFF
PARENT
```

---

# 6. Child Management

Thông tin cơ bản của trẻ:

```text
Child
├── child_id
├── name
├── date_of_birth
├── gender
├── address
├── avatar
├── class_id
└── status
```

Một trẻ có thể có nhiều phụ huynh.

Quan hệ:

```text
Parent N ─────── M Child
```

Thông qua bảng trung gian:

```text
child_parents
├── child_id
├── parent_id
└── relationship
```

Ví dụ relationship:

```text
FATHER
MOTHER
GUARDIAN
```

---

# 7. Class Management

Quản lý lớp học:

```text
Class
├── class_id
├── name
├── school_id
├── academic_year
└── status
```

Quan hệ:

```text
Class 1 ─────── N Child

Class N ─────── N Teacher
```

---

# 8. Attendance Management

Thông tin điểm danh:

```text
Attendance
├── attendance_id
├── child_id
├── date
├── check_in_time
├── check_out_time
├── status
└── recorded_by
```

Các trạng thái:

```text
PRESENT
ABSENT
LATE
EARLY_LEAVE
```

Flow cơ bản:

```text
Teacher
   │
   ▼
Check attendance
   │
   ▼
Attendance Service / Module
   │
   ▼
PostgreSQL
   │
   ▼
Notification
   │
   ▼
Parent
```

Ví dụ mở rộng:

```text
QR Code
   ↓
Check-in
   ↓
Attendance
   ↓
Notification
   ↓
Parent
```

---

# 9. Health Management

Thông tin sức khỏe:

```text
HealthRecord
├── hrecord_id
├── child_id
├── height
├── weight
├── temperature
├── allergies
├── medical_conditions
└── note
```

Các entity có thể mở rộng:

```text
HealthRecord
MedicalVisit
Medication
Allergy
Vaccination
```

Quan hệ:

```text
Child 1 ─────── N HealthRecord
Child 1 ─────── N MedicalVisit
Child 1 ─────── N Vaccination
```

---

# 10. Activity Management

Giáo viên có thể tạo các hoạt động:

```text
Activity
├── activity_id
├── title
├── description
├── date
├── class_id
└── created_by
```

Ví dụ:

- Vẽ tranh
- Đọc sách
- Thể dục
- Âm nhạc
- Trồng cây

Có thể lưu:

```text
Activity
├── Photos
├── Description
└── Child participation
```

Quan hệ:

```text
Child N ─────── N Activity
```

thông qua:

```text
activity_participants
├── activity_id
├── child_id
└── participation_status
```

---

# 11. Pickup Management

Quản lý người đón trẻ.

Ví dụ:

```text
PickupRequest
├── id
├── child_id
├── pickup_person
├── relationship
├── expected_time
├── status
└── verified_by
```

Flow:

```text
Parent
   │
   ▼
Pickup Request
   │
   ▼
Teacher
   │
   ▼
Verify
   │
   ▼
Child Released
```

Các trạng thái:

```text
PENDING
APPROVED
REJECTED
COMPLETED
```

Module này có thể dùng để nghiên cứu:

- Authentication
- Authorization
- Security
- Audit Log
- Notification
- Concurrency

---

# 12. Notification Management

Thông báo có thể phát sinh từ nhiều module:

```text
Attendance
Health
Activity
Pickup
System
```

Ví dụ:

```text
Teacher checks in child
        ↓
Attendance event
        ↓
Notification
        ↓
Parent
```

Các kênh có thể hỗ trợ:

```text
IN_APP
PUSH_NOTIFICATION
EMAIL
SMS
```

Ban đầu chỉ cần `IN_APP`, sau này mở rộng.

---

# 13. Reporting

Một số báo cáo:

- Số trẻ đi học trong ngày.
- Tỷ lệ chuyên cần.
- Số trẻ đi muộn.
- Tình trạng sức khỏe.
- Số lượng hoạt động.
- Báo cáo theo lớp.
- Báo cáo theo thời gian.

Ví dụ:

```text
GET /reports/attendance
GET /reports/classes
GET /reports/health
```

---

# 14. Database Design

Có thể sử dụng **PostgreSQL**.

Schema dự kiến:

```text
users
  │
  ├──────── parents
  ├──────── teachers
  └──────── medical_staff

children
  │
  ├──────── child_parents
  ├──────── attendance
  ├──────── health_records
  ├──────── vaccinations
  └──────── activity_participants

classes
  │
  ├──────── children
  └──────── teachers

activities
  │
  └──────── activity_participants

pickup_requests

notifications

audit_logs
```

Các quan hệ chính:

```text
Parent 1 ─────── N Child

Child N ─────── N Parent

Class 1 ─────── N Child

Class N ─────── N Teacher

Child 1 ─────── N Attendance

Child 1 ─────── N HealthRecord

Child N ─────── N Activity
```

---

# 15. Authorization Matrix

| Action | Parent | Teacher | Medical | Manager | Admin |
|---|---:|---:|---:|---:|---:|
| Xem con mình | ✅ | ❌ | ❌ | ✅ | ✅ |
| Xem trẻ trong lớp | ❌ | ✅ | ✅ | ✅ | ✅ |
| Điểm danh | ❌ | ✅ | ❌ | ✅ | ✅ |
| Sửa Health Record | ❌ | ❌ | ✅ | ✅ | ✅ |
| Xem Health Record | Có giới hạn | Có giới hạn | ✅ | Có giới hạn | ✅ |
| Tạo Activity | ❌ | ✅ | ❌ | ✅ | ✅ |
| Tạo Pickup Request | ✅ | ❌ | ❌ | ❌ | ✅ |
| Xác nhận Pickup | ❌ | ✅ | ❌ | ✅ | ✅ |
| Quản lý User | ❌ | ❌ | ❌ | ❌ | ✅ |

> Cần thiết kế permission chi tiết hơn khi triển khai thực tế.

---

# 16. Kiến trúc ban đầu

Không triển khai Microservices ngay.

Ưu tiên:

**Modular Monolith**

```text
                 React + TypeScript
                        │
                        ▼
                    REST API
                        │
                        ▼
                 NestJS Backend
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
      PostgreSQL                    Redis
```

Backend:

```text
src/
├── auth/
├── users/
├── children/
├── parents/
├── teachers/
├── classes/
├── attendance/
├── health/
├── activities/
├── pickup/
├── notifications/
└── reports/
```

Mỗi module nên có boundary rõ ràng.

---

# 17. Công nghệ dự kiến

## Frontend

```text
React
TypeScript
Vite
```

Có thể bổ sung:

```text
React Router
TanStack Query
Tailwind CSS
```

## Backend

Ưu tiên:

```text
NestJS
TypeScript
REST API
```

## Database

```text
PostgreSQL
```

## Cache / Session / Queue

Ban đầu:

```text
Redis
```

Sau này có thể nghiên cứu:

```text
Kafka / RabbitMQ
```

## File Storage

Không lưu ảnh trực tiếp vào PostgreSQL.

Có thể sử dụng:

```text
S3-compatible Object Storage
```

---

# 18. MVP cho môn Nhập môn CNPM

Không nên implement toàn bộ hệ thống ngay.

## Phase 1 — Authentication

```text
Register
Login
Logout
Role
Permission
```

## Phase 2 — Core Management

```text
Parent
Child
Teacher
Class
```

## Phase 3 — Attendance

```text
Check-in
Check-out
Attendance history
```

## Phase 4 — Health

```text
Health record
Vaccination
Medical information
```

## Phase 5 — Activity

```text
Create activity
View activity
Child participation
```

## Phase 6 — Notification

```text
In-app notification
```

## Phase 7 — Testing & Deployment

```text
Unit Test
Integration Test
E2E Test
Docker
Deployment
```

---

# 19. Tài liệu cần làm cho môn Nhập môn CNPM

```text
01. Problem Statement
       ↓
02. Stakeholder Analysis
       ↓
03. Functional Requirements
       ↓
04. Non-functional Requirements
       ↓
05. Use Case Diagram
       ↓
06. Activity Diagram
       ↓
07. Sequence Diagram
       ↓
08. Class Diagram
       ↓
09. ERD
       ↓
10. Architecture Design
       ↓
11. API Design
       ↓
12. Implementation
       ↓
13. Testing
       ↓
14. Deployment
```

---

# 20. Non-functional Requirements

Nên xác định ngay từ đầu.

## Performance

Ví dụ:

- API response thông thường < 500 ms.
- Hỗ trợ nhiều request đồng thời.
- Các truy vấn danh sách phải có pagination.

## Security

- Password được hash.
- JWT / session authentication.
- RBAC.
- API authorization.
- Audit log.
- Input validation.
- Rate limiting cho authentication API.

## Reliability

- Không mất dữ liệu điểm danh.
- Có transaction cho các nghiệp vụ quan trọng.
- Có backup database.

## Scalability

Hệ thống có khả năng mở rộng:

```text
100 children
      ↓
10,000 children
      ↓
100,000 children
      ↓
1,000,000 children
```

## Maintainability

- Modular architecture.
- Clean code.
- API documentation.
- Automated testing.
- Logging.

---

# 21. System Design — hướng phát triển sau này

Khi học môn Thiết kế hệ thống, có thể nâng cấp kiến trúc:

```text
                         Client
                           │
                           ▼
                     Load Balancer
                           │
                           ▼
                      API Gateway
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 Auth Service       Child Service      Attendance Service
       │                   │                   │
       ▼                   ▼                   ▼
    Auth DB             Child DB          Attendance DB

       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 Health Service      Activity Service   Notification Service
```

Có thể chuyển dần từng module thành service độc lập khi cần.

---

# 22. Những bài toán System Design có thể khai thác

## 22.1. Scalability

Giả sử:

```text
1,000 schools
×
500 children / school
=
500,000 children
```

Phân tích:

- QPS.
- Peak traffic.
- Database capacity.
- Read/write ratio.
- Horizontal scaling.

---

## 22.2. Caching

Ví dụ:

```text
GET /classes/123
```

Flow:

```text
Client
  ↓
API
  ↓
Redis
  │
  ├── HIT → Return
  │
  └── MISS
       ↓
    PostgreSQL
```

---

## 22.3. Message Queue

Ví dụ khi điểm danh:

```text
Attendance Service
        ↓
     Event
        ↓
    Message Queue
        ↓
Notification Service
        ↓
      Parent
```

Có thể sử dụng:

```text
Kafka
RabbitMQ
```

---

# 23. Object Storage

Ảnh hoạt động không nên lưu trực tiếp trong database.

Kiến trúc:

```text
React
  │
  ▼
Backend
  │
  ▼
Object Storage
  │
  └── Activity Photos
```

Database chỉ lưu metadata:

```text
activity_images
├── id
├── activity_id
├── object_key
├── url
└── created_at
```

---

# 24. Audit Log

Các thao tác quan trọng cần được ghi lại.

Ví dụ:

```text
Teacher changed health record
        ↓
      Audit Log
```

Hoặc:

```text
Admin deleted user
        ↓
      Audit Log
```

Schema:

```text
audit_logs
├── id
├── user_id
├── action
├── resource_type
├── resource_id
├── old_value
├── new_value
├── ip_address
└── created_at
```

---

# 25. Ví dụ System Design Problem

Một bài toán có thể sử dụng trong môn Thiết kế hệ thống:

> Thiết kế một nền tảng ChildCare Management phục vụ 1.000 trường, mỗi trường có trung bình 500 trẻ. Hệ thống phải hỗ trợ phụ huynh theo dõi điểm danh, sức khỏe và hoạt động của trẻ. Trong giờ cao điểm buổi sáng, hàng trăm nghìn request có thể được gửi đồng thời.

Cần thiết kế:

```text
Requirement
     ↓
Capacity Estimation
     ↓
API Design
     ↓
Database Design
     ↓
Caching
     ↓
Load Balancing
     ↓
Message Queue
     ↓
Object Storage
     ↓
Notification
     ↓
Monitoring
     ↓
Security
     ↓
High Availability
```

---

# 26. Ví dụ một request quan trọng

Use case:

> Phụ huynh kiểm tra xem con đã đến trường chưa.

## MVP

```text
React
  ↓
GET /children/{id}/attendance/today
  ↓
NestJS
  ↓
PostgreSQL
  ↓
Attendance
```

## Scalable version

```text
10,000 clients
      ↓
Load Balancer
      ↓
API Servers
      ↓
Redis
      │
      ├── HIT → Return
      │
      └── MISS
           ↓
       PostgreSQL
```

Đây là một ví dụ tốt để chứng minh sự khác biệt giữa:

```text
Software Engineering
        ↓
System Design
```

---

# 27. Security

Vì hệ thống chứa dữ liệu của trẻ em, security phải được xem xét ngay từ đầu.

Các nguyên tắc:

- Authentication.
- Authorization.
- Least privilege.
- Role-Based Access Control.
- Input validation.
- Password hashing.
- Secure token handling.
- Audit logging.
- Rate limiting.
- Database backup.
- HTTPS/TLS.
- Không expose dữ liệu trẻ không cần thiết.

---

# 28. Roadmap

## Giai đoạn 1 — Requirements

- [ ] Problem statement
- [ ] Stakeholder
- [ ] Functional requirements
- [ ] Non-functional requirements
- [ ] Use cases

## Giai đoạn 2 — Analysis & Design

- [ ] Use Case Diagram
- [ ] Activity Diagram
- [ ] Sequence Diagram
- [ ] Class Diagram
- [ ] ERD
- [ ] API specification
- [ ] Architecture

## Giai đoạn 3 — Backend

- [ ] Project setup
- [ ] Authentication
- [ ] Authorization
- [ ] Child management
- [ ] Parent management
- [ ] Teacher management
- [ ] Class management
- [ ] Attendance
- [ ] Health
- [ ] Activity
- [ ] Notification

## Giai đoạn 4 — Frontend

- [ ] Login
- [ ] Dashboard
- [ ] Child management
- [ ] Attendance
- [ ] Health
- [ ] Activities
- [ ] Notifications
- [ ] Admin dashboard

## Giai đoạn 5 — Testing

- [ ] Unit tests
- [ ] Integration tests
- [ ] API tests
- [ ] E2E tests
- [ ] Security testing

## Giai đoạn 6 — Deployment

- [ ] Docker
- [ ] Docker Compose
- [ ] CI/CD
- [ ] Production deployment
- [ ] Logging
- [ ] Monitoring

## Giai đoạn 7 — System Design

- [ ] Capacity estimation
- [ ] Load balancing
- [ ] Redis
- [ ] Message queue
- [ ] Object storage
- [ ] Database scaling
- [ ] Microservices
- [ ] Observability
- [ ] High availability
