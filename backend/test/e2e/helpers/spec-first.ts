import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { load } from "js-yaml";
import type { Response } from "supertest";

// Công cụ cho e2e viết trước code (giai đoạn 4, 5): bật test khi code xuất hiện, và đối chiếu phản hồi với openapi.yaml.

const SRC = resolve(__dirname, "../../../src");
const SPEC_PATH = resolve(__dirname, "../../../../docs/02-design/openapi.yaml");

/** true nếu có file *.controller.ts trong src/ khớp mẫu (ví dụ route "pickup-requests"). */
export function controllerMentions(pattern: RegExp): boolean {
	return readdirSync(SRC, { recursive: true })
		.map(String)
		.filter((file) => file.endsWith(".controller.ts"))
		.some((file) => pattern.test(readFileSync(join(SRC, file), "utf8")));
}

/** describe khi điều kiện đúng hoặc biến môi trường flag = "1"; ngược lại describe.skip. */
export const describeWhen = (enabled: boolean, flag: string) => (enabled || process.env[flag] === "1" ? describe : describe.skip);

type Spec = {
	paths: Record<string, Record<string, { responses: Record<string, { content?: { "application/json"?: { schema?: unknown } } }> }>>;
	components: unknown;
};

/** Trả về hàm expectSchema(path, method, res): kiểm tra body khớp schema phản hồi tương ứng trong openapi.yaml. */
export function openApiMatcher() {
	const spec = load(readFileSync(SPEC_PATH, "utf8")) as Spec;
	const ajv = new Ajv2020({ strict: false, allErrors: true });
	addFormats(ajv);
	ajv.addSchema({ $id: "spec", components: spec.components });
	return (path: string, method: string, res: Response) => {
		const schema = spec.paths[path]?.[method]?.responses[String(res.status)]?.content?.["application/json"]?.schema;
		const endpoint = `${method.toUpperCase()} ${path} -> ${res.status}`;
		if (!schema) throw new Error(`openapi.yaml không mô tả ${endpoint}`);
		const check = ajv.compile(JSON.parse(JSON.stringify(schema).replace(/"#\/components/g, '"spec#/components')));
		const problems = check(res.body) ? [] : (check.errors ?? []).map((e) => `${e.instancePath || "(gốc)"} ${e.message}`);
		expect({ endpoint, problems }).toEqual({ endpoint, problems: [] });
	};
}
