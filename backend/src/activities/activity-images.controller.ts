import { Controller, Get, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import type { Response } from "express";
import { ActivitiesService } from "./activities.service";

// Tách route ảnh khỏi controller có JWT guard để thẻ <img> có thể tải ảnh bình thường.
@Controller("uploads/activities")
export class ActivityImagesController {
	constructor(private readonly activities: ActivitiesService) {}
	@Get(":activityId/:imageId")
	async read(@Param("activityId", ParseUUIDPipe) _activityId: string, @Param("imageId", ParseUUIDPipe) imageId: string, @Res() response: Response) {
		const image = await this.activities.getImage(_activityId, imageId);
		response.type(image.mimeType).send(image.buffer);
	}
}
