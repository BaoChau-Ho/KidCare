import { Injectable, Logger } from "@nestjs/common";

// Sự kiện nghiệp vụ. Module điểm danh/đơn nghỉ chỉ phát sự kiện, không gọi thẳng module Thông báo;
// Stage 6 đăng ký lắng nghe các sự kiện này để tạo thông báo (stage-3, bước 4).
export interface AttendanceRecordedEvent {
	attendanceId: string;
	childId: string;
	classId: string;
	date: string;
	action: "CHECK_IN" | "CHECK_OUT" | "MARK_ABSENT" | "UPDATE";
	status: string;
	actorUserId: string;
}

export interface LeaveRequestCreatedEvent {
	leaveRequestId: string;
	childId: string;
	classId: string;
	parentUserId: string;
	fromDate: string;
	toDate: string;
}

export interface LeaveRequestDecidedEvent {
	leaveRequestId: string;
	childId: string;
	classId: string;
	parentUserId: string;
	decision: "APPROVED" | "REJECTED";
	decidedByUserId: string;
	fromDate: string;
	toDate: string;
	reason: string | null;
}

export interface HealthRecordChangedEvent {
	childId: string;
	resourceType: "health_record" | "allergy" | "medical_condition" | "vaccination" | "medical_visit";
	resourceId: string;
}

export interface DomainEvents {
	"attendance.recorded": AttendanceRecordedEvent;
	"leave-request.created": LeaveRequestCreatedEvent;
	"leave-request.decided": LeaveRequestDecidedEvent;
	"health-record.changed": HealthRecordChangedEvent;
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

/**
 * Bus sự kiện trong tiến trình, không cần thư viện ngoài. Gọi publish() SAU KHI transaction đã commit.
 * Lỗi của người lắng nghe được ghi log và không bao giờ làm hỏng request đã thành công.
 * Có thể thay bằng @nestjs/event-emitter mà không đổi nơi gọi.
 */
@Injectable()
export class DomainEventPublisher {
	private readonly logger = new Logger(DomainEventPublisher.name);
	private readonly handlers = new Map<keyof DomainEvents, Array<Handler<keyof DomainEvents>>>();

	subscribe<K extends keyof DomainEvents>(name: K, handler: Handler<K>): () => void {
		const list = this.handlers.get(name) ?? [];
		list.push(handler as Handler<keyof DomainEvents>);
		this.handlers.set(name, list);
		return () => this.handlers.set(name, (this.handlers.get(name) ?? []).filter((h) => h !== handler));
	}

	publish<K extends keyof DomainEvents>(name: K, payload: DomainEvents[K]): void {
		for (const handler of this.handlers.get(name) ?? []) {
			try {
				void Promise.resolve(handler(payload)).catch((error: unknown) => this.logFailure(name, error));
			} catch (error) {
				this.logFailure(name, error);
			}
		}
	}

	private logFailure(name: string, error: unknown) {
		// Không ghi payload vì có thể chứa định danh của trẻ.
		this.logger.error(`Người lắng nghe sự kiện ${name} bị lỗi: ${error instanceof Error ? error.message : String(error)}`);
	}
}
