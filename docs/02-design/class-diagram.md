# KidCare — Class Diagrams

Các sơ đồ dưới đây được trích từ `06_So_Do_Use_Case.md`: sơ đồ tổng thể và sơ đồ lớp riêng của từng UC-01 đến UC-15. Đây là mô hình lớp nghiệp vụ, chưa phải cấu trúc TypeORM entity cuối cùng.

ERD mô tả bảng và khóa ngoại ở góc nhìn database tại [erd.md](erd.md). Class diagram mô tả lớp, thuộc tính, hành vi và quan hệ ở góc nhìn hướng đối tượng. Trước khi code, cần thống nhất các khác biệt về ID (`UUID` trong tài liệu nguồn, `int` trong ERD hiện tại), tên lớp và trạng thái.

## Class Diagram tổng thể

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String passwordHash
        +String fullName
        +String phone
        +Role role
        +UserStatus status
    }
    class Parent {
        +String address
    }
    class Teacher {
        +String specialization
    }
    class MedicalStaff {
        +String licenseNumber
    }
    class Child {
        +UUID id
        +String name
        +Date dateOfBirth
        +Gender gender
        +String address
        +String avatar
        +ChildStatus status
    }
    class ChildParent {
        +Relationship relationship
    }
    class ClassRoom {
        +UUID id
        +String name
        +String academicYear
        +ClassStatus status
    }
    class Attendance {
        +UUID id
        +Date date
        +DateTime checkInTime
        +DateTime checkOutTime
        +AttendanceStatus status
    }
    class LeaveRequest {
        +UUID id
        +Date fromDate
        +Date toDate
        +String reason
    }
    class HealthRecord {
        +UUID id
        +Float height
        +Float weight
        +Float temperature
        +String note
        +DateTime recordedAt
    }
    class Allergy {
        +String allergen
        +String severity
    }
    class MedicalCondition {
        +String name
        +String note
    }
    class Vaccination {
        +String vaccineName
        +Int doseNumber
        +Date vaccinatedAt
    }
    class MedicalVisit {
        +DateTime visitedAt
        +String symptoms
        +String conclusion
    }
    class Medication {
        +String name
        +String dosage
        +String schedule
    }
    class Activity {
        +UUID id
        +String title
        +String description
        +Date date
    }
    class ActivityParticipant {
        +ParticipationStatus participationStatus
    }
    class ActivityImage {
        +String objectKey
        +String url
    }
    class PickupRequest {
        +UUID id
        +String pickupPerson
        +String relationship
        +DateTime expectedTime
        +PickupStatus status
    }
    class Notification {
        +UUID id
        +String title
        +String content
        +NotificationChannel channel
        +Boolean isRead
    }
    class AuditLog {
        +UUID id
        +String action
        +String resourceType
        +UUID resourceId
        +JSON oldValue
        +JSON newValue
        +String ipAddress
        +DateTime createdAt
    }

    User <|-- Parent
    User <|-- Teacher
    User <|-- MedicalStaff

    Parent "1" -- "*" ChildParent
    Child "1" -- "*" ChildParent
    ClassRoom "1" -- "*" Child : gồm
    ClassRoom "*" -- "*" Teacher : phân công

    Child "1" -- "*" Attendance
    User "1" -- "*" Attendance : ghi nhận
    Child "1" -- "*" LeaveRequest
    Parent "1" -- "*" LeaveRequest : gửi

    Child "1" -- "*" HealthRecord
    Child "1" -- "*" Allergy
    Child "1" -- "*" MedicalCondition
    Child "1" -- "*" Vaccination
    Child "1" -- "*" MedicalVisit
    MedicalVisit "1" -- "*" Medication

    ClassRoom "1" -- "*" Activity
    Teacher "1" -- "*" Activity : tạo
    Activity "1" -- "*" ActivityParticipant
    Child "1" -- "*" ActivityParticipant
    Activity "1" -- "*" ActivityImage

    Child "1" -- "*" PickupRequest
    Parent "1" -- "*" PickupRequest : tạo
    Teacher "0..1" -- "*" PickupRequest : xác minh

    User "1" -- "*" Notification : nhận
    User "1" -- "*" AuditLog : thực hiện
```

## UC-01 — Đăng nhập

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String passwordHash
        +Role role
        +UserStatus status
        +verifyPassword(raw) bool
        +isLocked() bool
    }
    class AuthSession {
        +UUID id
        +String refreshToken
        +DateTime expiresAt
        +DateTime revokedAt
        +revoke()
    }
    class Role {
        <<enumeration>>
        ADMIN
        MANAGER
        TEACHER
        MEDICAL_STAFF
        PARENT
    }
    class UserStatus {
        <<enumeration>>
        ACTIVE
        LOCKED
    }
    User "1" -- "*" AuthSession : có
    User --> Role
    User --> UserStatus
```

## UC-02 — Đăng ký tài khoản

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String passwordHash
        +String fullName
        +String phone
        +Role role
        +UserStatus status
        +setPassword(raw)
    }
    class Parent {
        +String address
        +register(dto) Parent
    }
    class Role {
        <<enumeration>>
        ADMIN
        MANAGER
        TEACHER
        MEDICAL_STAFF
        PARENT
    }
    User <|-- Parent
    User --> Role
```

## UC-03 — Quản lý tài khoản người dùng

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String fullName
        +Role role
        +UserStatus status
        +changeRole(role)
        +lock()
        +unlock()
    }
    class AuditLog {
        +UUID id
        +String action
        +String resourceType
        +UUID resourceId
        +JSON oldValue
        +JSON newValue
        +String ipAddress
        +DateTime createdAt
    }
    class Role {
        <<enumeration>>
        ADMIN
        MANAGER
        TEACHER
        MEDICAL_STAFF
        PARENT
    }
    class UserStatus {
        <<enumeration>>
        ACTIVE
        LOCKED
    }
    User "1" -- "*" AuditLog : thực hiện
    User --> Role
    User --> UserStatus
```

## UC-04 — Quản lý hồ sơ trẻ — tiếp nhận bé mới

```mermaid
classDiagram
    class Child {
        +UUID id
        +String name
        +Date dateOfBirth
        +Gender gender
        +String address
        +String avatar
        +ChildStatus status
        +assignClass(classRoom)
        +linkParent(parent, relationship)
        +deactivate()
    }
    class Parent {
        +UUID id
        +String fullName
        +String email
        +String phone
    }
    class ChildParent {
        +Relationship relationship
    }
    class ClassRoom {
        +UUID id
        +String name
        +String academicYear
    }
    class Relationship {
        <<enumeration>>
        FATHER
        MOTHER
        GUARDIAN
    }
    class ChildStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
    }
    Child "1" -- "*" ChildParent
    Parent "1" -- "*" ChildParent
    ChildParent --> Relationship
    ClassRoom "1" -- "*" Child : gồm
    Child --> ChildStatus
```

## UC-05 — Quản lý lớp học và phân công giáo viên

```mermaid
classDiagram
    class ClassRoom {
        +UUID id
        +String name
        +String academicYear
        +ClassStatus status
        +assignTeacher(teacher)
        +removeTeacher(teacher)
        +close()
    }
    class Teacher {
        +UUID id
        +String fullName
        +String specialization
    }
    class Child {
        +UUID id
        +String name
    }
    class ClassStatus {
        <<enumeration>>
        ACTIVE
        CLOSED
    }
    ClassRoom "*" -- "*" Teacher : phân công
    ClassRoom "1" -- "*" Child : gồm
    ClassRoom --> ClassStatus
```

## UC-06 — Điểm danh trẻ

```mermaid
classDiagram
    class Attendance {
        +UUID id
        +Date date
        +DateTime checkInTime
        +DateTime checkOutTime
        +AttendanceStatus status
        +checkIn(time)
        +checkOut(time)
    }
    class Child {
        +UUID id
        +String name
    }
    class Teacher {
        +UUID id
        +String fullName
    }
    class ClassRoom {
        +UUID id
        +String name
    }
    class Notification {
        +UUID id
        +String title
        +String content
        +NotificationChannel channel
    }
    class AttendanceStatus {
        <<enumeration>>
        PRESENT
        ABSENT
        LATE
        EARLY_LEAVE
    }
    Child "1" -- "*" Attendance
    Teacher "1" -- "*" Attendance : ghi nhận
    ClassRoom "1" -- "*" Child : gồm
    ClassRoom "*" -- "*" Teacher : phân công
    Attendance ..> Notification : phát sinh
    Attendance --> AttendanceStatus
```

## UC-07 — Theo dõi tình hình của con

```mermaid
classDiagram
    class Parent {
        +UUID id
        +String fullName
        +isParentOf(childId) bool
    }
    class Child {
        +UUID id
        +String name
    }
    class ChildParent {
        +Relationship relationship
    }
    class Attendance {
        +Date date
        +DateTime checkInTime
        +DateTime checkOutTime
        +AttendanceStatus status
    }
    class HealthRecord {
        +Float height
        +Float weight
        +Float temperature
        +String note
        +toParentView() HealthRecordView
    }
    class Activity {
        +String title
        +String description
        +Date date
    }
    class ActivityParticipant {
        +ParticipationStatus participationStatus
    }
    Parent "1" -- "*" ChildParent
    Child "1" -- "*" ChildParent
    Child "1" -- "*" Attendance
    Child "1" -- "*" HealthRecord
    Child "1" -- "*" ActivityParticipant
    Activity "1" -- "*" ActivityParticipant
```

## UC-08 — Gửi yêu cầu nghỉ học

```mermaid
classDiagram
    class LeaveRequest {
        +UUID id
        +Date fromDate
        +Date toDate
        +String reason
        +DateTime createdAt
        +overlaps(fromDate, toDate) bool
    }
    class Child {
        +UUID id
        +String name
    }
    class Parent {
        +UUID id
        +String fullName
    }
    class ClassRoom {
        +UUID id
        +String name
    }
    class Teacher {
        +UUID id
        +String fullName
    }
    class Notification {
        +UUID id
        +String title
        +String content
    }
    Child "1" -- "*" LeaveRequest
    Parent "1" -- "*" LeaveRequest : gửi
    ClassRoom "1" -- "*" Child : gồm
    ClassRoom "*" -- "*" Teacher : phân công
    LeaveRequest ..> Notification : phát sinh
```

## UC-09 — Quản lý hồ sơ sức khỏe

```mermaid
classDiagram
    class Child {
        +UUID id
        +String name
    }
    class HealthRecord {
        +UUID id
        +Float height
        +Float weight
        +Float temperature
        +String note
        +DateTime recordedAt
        +hasFever() bool
    }
    class Allergy {
        +String allergen
        +String severity
    }
    class MedicalCondition {
        +String name
        +String note
    }
    class Vaccination {
        +String vaccineName
        +Int doseNumber
        +Date vaccinatedAt
    }
    class MedicalVisit {
        +DateTime visitedAt
        +String symptoms
        +String conclusion
    }
    class Medication {
        +String name
        +String dosage
        +String schedule
    }
    class MedicalStaff {
        +UUID id
        +String fullName
    }
    class AuditLog {
        +String action
        +JSON oldValue
        +JSON newValue
    }
    Child "1" -- "*" HealthRecord
    Child "1" -- "*" Allergy
    Child "1" -- "*" MedicalCondition
    Child "1" -- "*" Vaccination
    Child "1" -- "*" MedicalVisit
    MedicalVisit "1" -- "*" Medication
    MedicalStaff "1" -- "*" HealthRecord : ghi nhận
    MedicalStaff "1" -- "*" AuditLog : thực hiện
```

## UC-10 — Tạo hoạt động

```mermaid
classDiagram
    class Activity {
        +UUID id
        +String title
        +String description
        +Date date
        +addParticipant(child, status)
        +attachImage(objectKey, url)
    }
    class ActivityParticipant {
        +ParticipationStatus participationStatus
    }
    class ActivityImage {
        +UUID id
        +String objectKey
        +String url
        +DateTime createdAt
    }
    class Child {
        +UUID id
        +String name
    }
    class ClassRoom {
        +UUID id
        +String name
    }
    class Teacher {
        +UUID id
        +String fullName
    }
    class ParticipationStatus {
        <<enumeration>>
        JOINED
        NOT_JOINED
    }
    ClassRoom "1" -- "*" Activity
    Teacher "1" -- "*" Activity : tạo
    Activity "1" -- "*" ActivityParticipant
    Child "1" -- "*" ActivityParticipant
    Activity "1" -- "*" ActivityImage
    ActivityParticipant --> ParticipationStatus
```

## UC-11 — Đăng ký người đón trẻ

```mermaid
classDiagram
    class PickupRequest {
        +UUID id
        +String pickupPerson
        +String relationship
        +String idNumber
        +String phone
        +DateTime expectedTime
        +PickupStatus status
        +cancel()
    }
    class Child {
        +UUID id
        +String name
    }
    class Parent {
        +UUID id
        +String fullName
    }
    class PickupStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
        COMPLETED
        CANCELLED
    }
    Child "1" -- "*" PickupRequest
    Parent "1" -- "*" PickupRequest : tạo
    PickupRequest --> PickupStatus
```

## UC-12 — Xác nhận đón trẻ

```mermaid
classDiagram
    class PickupRequest {
        +UUID id
        +String pickupPerson
        +DateTime expectedTime
        +PickupStatus status
        +String rejectReason
        +approve(teacher)
        +reject(teacher, reason)
        +complete()
    }
    class Teacher {
        +UUID id
        +String fullName
    }
    class Child {
        +UUID id
        +String name
    }
    class Attendance {
        +DateTime checkOutTime
        +checkOut(time)
    }
    class AuditLog {
        +String action
        +String resourceType
        +UUID resourceId
    }
    class PickupStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
        COMPLETED
        CANCELLED
    }
    Child "1" -- "*" PickupRequest
    Teacher "0..1" -- "*" PickupRequest : xác minh
    Child "1" -- "*" Attendance
    Teacher "1" -- "*" AuditLog : thực hiện
    PickupRequest --> PickupStatus
```

## UC-13 — Gửi thông báo cho phụ huynh

```mermaid
classDiagram
    class Notification {
        +UUID id
        +String title
        +String content
        +NotificationChannel channel
        +Boolean isRead
        +DateTime createdAt
    }
    class Teacher {
        +UUID id
        +String fullName
        +sendNotification(target, title, content)
    }
    class Parent {
        +UUID id
        +String fullName
    }
    class Child {
        +UUID id
        +String name
    }
    class ClassRoom {
        +UUID id
        +String name
    }
    class NotificationChannel {
        <<enumeration>>
        IN_APP
        PUSH_NOTIFICATION
        EMAIL
        SMS
    }
    Teacher "1" -- "*" Notification : gửi
    Parent "1" -- "*" Notification : nhận
    ClassRoom "*" -- "*" Teacher : phân công
    ClassRoom "1" -- "*" Child : gồm
    Child "*" -- "*" Parent
    Notification --> NotificationChannel
```

## UC-14 — Xem thông báo

```mermaid
classDiagram
    class User {
        +UUID id
        +String fullName
        +Role role
    }
    class Notification {
        +UUID id
        +String title
        +String content
        +NotificationChannel channel
        +Boolean isRead
        +DateTime createdAt
        +markAsRead()
    }
    class NotificationChannel {
        <<enumeration>>
        IN_APP
        PUSH_NOTIFICATION
        EMAIL
        SMS
    }
    User "1" -- "*" Notification : nhận
    Notification --> NotificationChannel
```

## UC-15 — Xem báo cáo

```mermaid
classDiagram
    class AttendanceReport {
        +UUID classId
        +Date fromDate
        +Date toDate
        +Int totalChildren
        +Int presentCount
        +Int lateCount
        +Int earlyLeaveCount
        +Float attendanceRate
    }
    class HealthReport {
        +Int childrenWithAllergy
        +Int childrenWithCondition
        +Float vaccinationRate
    }
    class ActivityReport {
        +Int activityCount
        +Float participationRate
    }
    class ClassRoom {
        +UUID id
        +String name
    }
    class Attendance {
        +Date date
        +AttendanceStatus status
    }
    class HealthRecord {
        +Float height
        +Float weight
    }
    class Activity {
        +String title
        +Date date
    }
    AttendanceReport ..> Attendance : tổng hợp từ
    HealthReport ..> HealthRecord : tổng hợp từ
    ActivityReport ..> Activity : tổng hợp từ
    AttendanceReport --> ClassRoom
    ActivityReport --> ClassRoom
```


