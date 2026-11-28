import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { In } from "typeorm";
import { AuditLog } from "./audit-log.entity";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import { User } from "../users/user.entity";
import { Classroom } from "../classes/class.entity";
import { Child } from "../children/child.entity";

export type AuditLogInput = Pick<
	AuditLog,
	"action" | "resourceType" | "resourceId"
> &
	Partial<
		Pick<
			AuditLog,
			"actorUserId" | "actorName" | "oldValue" | "newValue" | "ipAddress"
		>
	>;

@Injectable()
export class AuditLogsService {
    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogsRepository: Repository<AuditLog>,
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
		@InjectRepository(Classroom)
		private readonly classesRepository: Repository<Classroom>,
		@InjectRepository(Child)
		private readonly childrenRepository: Repository<Child>,
    ) {}
	async record(manager: EntityManager, input: AuditLogInput) {
		const repository = manager.getRepository(AuditLog);
		const log = repository.create(input);

		return repository.save(log);
	}
    async list(query: ListAuditLogsQueryDto) {
        if (query.from > query.to) {
            throw new BadRequestException({
                code: "INVALID_DATE_RANGE",
                message: "`from` phải bằng hoặc trước `to`.",
            });
        }

        const from = new Date(`${query.from}T00:00:00.000Z`);
        const toExclusive = new Date(`${query.to}T00:00:00.000Z`);
        toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

        const qb = this.auditLogsRepository
            .createQueryBuilder("log")
            .select([
                "log.id",
                "log.actorUserId",
                "log.actorName",
                "log.action",
                "log.resourceType",
                "log.resourceId",
                "log.oldValue",
                "log.newValue",
                "log.ipAddress",
                "log.createdAt",
            ])
            .where("log.createdAt >= :from", { from })
            .andWhere("log.createdAt < :toExclusive", { toExclusive });

        if (query.actorUserId) {
            qb.andWhere("log.actorUserId = :actorUserId", {
                actorUserId: query.actorUserId,
            });
        }

        if (query.action) {
            qb.andWhere("log.action = :action", { action: query.action });
        }

        if (query.resourceType) {
            qb.andWhere("log.resourceType = :resourceType", {
                resourceType: query.resourceType,
            });
        }

        if (query.resourceId) {
            qb.andWhere("log.resourceId = :resourceId", {
                resourceId: query.resourceId,
            });
        }

        qb.orderBy("log.createdAt", "DESC")
            .addOrderBy("log.id", "DESC")
            .skip((query.page - 1) * query.limit)
            .take(query.limit);

        const [items, totalItems] = await qb.getManyAndCount();
		const resourceNames = await this.getResourceNames(items);

        return {
			items: items.map((item) => ({
				...item,
				resourceName: resourceNames.get(`${item.resourceType}:${item.resourceId}`) ?? null,
			})),
            pageInfo: {
                page: query.page,
                limit: query.limit,
                totalItems,
                totalPages: Math.ceil(totalItems / query.limit),
            },
        };
    }

	private async getResourceNames(items: AuditLog[]) {
		const idsByType = new Map<string, Set<string>>();
		for (const item of items) {
			const ids = idsByType.get(item.resourceType) ?? new Set<string>();
			ids.add(item.resourceId);
			idsByType.set(item.resourceType, ids);
		}

		const names = new Map<string, string>();
		const userIds = [...(idsByType.get("user") ?? [])];
		const classIds = [...(idsByType.get("class") ?? [])];
		const childIds = [...(idsByType.get("child") ?? [])];

		const [users, classes, children] = await Promise.all([
			userIds.length
				? this.usersRepository.find({
					where: { id: In(userIds) },
					select: ["id", "email", "fullName"],
				})
				: [],
			classIds.length
				? this.classesRepository.find({
					where: { id: In(classIds) },
					select: ["id", "name"],
				})
				: [],
			childIds.length
				? this.childrenRepository.find({
					where: { id: In(childIds) },
					select: ["id", "name"],
				})
				: [],
		]);

		for (const user of users) {
			names.set(`user:${user.id}`, user.fullName ?? user.email);
		}
		for (const classroom of classes) names.set(`class:${classroom.id}`, classroom.name);
		for (const child of children) names.set(`child:${child.id}`, child.name);
		return names;
	}
}
