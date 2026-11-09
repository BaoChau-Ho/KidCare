import { Module } from "@nestjs/common";
import { DomainEventPublisher } from "./domain-event.publisher";

@Module({
	providers: [DomainEventPublisher],
	exports: [DomainEventPublisher],
})
export class DomainEventsModule {}
