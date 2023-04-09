// contributed by @Maxim-Mazurok

import CryptoJS from "crypto-js";
import { parse, stringify } from "qs";

function createNonce() {
	let s = "";
	const length = 32;
	do {
		s += Math.random().toString(36).slice(2);
	} while (s.length < length);
	s = s.slice(0, Math.max(0, length));
	return s;
}

const getAuthHeader = (
	apiKey: string,
	apiSecret: string,
	time: string,
	nonce: string,
	organizationId = "",
	request: {
		method: string;
		path: string;
		query: Record<string, unknown> | string;
		body: any;
	},
) => {
	const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, apiSecret);

	hmac.update(apiKey);
	hmac.update("\0");
	hmac.update(time);
	hmac.update("\0");
	hmac.update(nonce);
	hmac.update("\0");
	hmac.update("\0");
	if (organizationId) hmac.update(organizationId);
	hmac.update("\0");
	hmac.update("\0");
	hmac.update(request.method);
	hmac.update("\0");
	hmac.update(request.path);
	hmac.update("\0");
	if (request.query)
		hmac.update(
			typeof request.query == "object"
				? stringify(request.query)
				: request.query,
		);
	if (request.body) {
		hmac.update("\0");
		hmac.update(
			typeof request.body == "object"
				? JSON.stringify(request.body)
				: request.body,
		);
	}

	return apiKey + ":" + hmac.finalize().toString(CryptoJS.enc.Hex);
};

export default class Api {
	private readonly locale: string;
	private readonly host: string;
	private readonly key: string;
	private readonly secret: string;
	private readonly org: string;
	private localTimeDiff?: number;

	constructor({
		            locale,
		            apiHost,
		            apiKey,
		            apiSecret,
		            orgId,
	            }: {
		locale?: string;
		apiHost: string;
		apiKey: string;
		apiSecret: string;
		orgId: string;
	}) {
		this.locale = locale || "en";
		this.host = apiHost;
		this.key = apiKey;
		this.secret = apiSecret;
		this.org = orgId;

		this.getTime();
	}

	async getTime() {
		const response = (await (
			await fetch(this.host + "/api/v2/time")
		).json()) as { serverTime: number };
		this.localTimeDiff = response.serverTime - Date.now();
		return response;
	}

	private async apiCall(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		options?: {
			query: Record<string, unknown>;
			body?: any;
			time?: number;
		},
	) {
		let query = {},
			body,
			time;
		if (options) ({ query, body, time } = options);

		if (this.localTimeDiff === undefined) {
			throw new Error("Get server time first .getTime()");
		}

		// query in path
		const [pathOnly, pathQuery] = path.split("?");
		if (pathQuery) query = { ...parse(pathQuery), ...query };

		const nonce = createNonce();
		const timestamp = (time || Date.now() + this.localTimeDiff).toString();

		return (
			await fetch(`${this.host}${pathOnly}?${stringify(query)}`, {
				method: method,
				headers: {
					"X-Request-Id": nonce,
					"X-User-Agent": "NHNodeClient",
					"X-Time": timestamp,
					"X-Nonce": nonce,
					"X-User-Lang": this.locale,
					"X-Organization-Id": this.org,
					"X-Auth": getAuthHeader(
						this.key,
						this.secret,
						timestamp,
						nonce,
						this.org,
						{
							method,
							path: pathOnly,
							query,
							body,
						},
					),
				},
				body,
			})
		).json();
	}

	get(
		path: string,
		options?: {
			query: Record<string, unknown>;
			body?: any;
			time?: number;
		},
	) {
		return this.apiCall("GET", path, options);
	}

	post(
		path: string,
		options?: {
			query: Record<string, unknown>;
			body?: any;
			time?: number;
		},
	) {
		return this.apiCall("POST", path, options);
	}

	put(
		path: string,
		options?: {
			query: Record<string, unknown>;
			body?: any;
			time?: number;
		},
	) {
		return this.apiCall("PUT", path, options);
	}

	delete(
		path: string,
		options?: {
			query: Record<string, unknown>;
			body?: any;
			time?: number;
		},
	) {
		return this.apiCall("DELETE", path, options);
	}
}

// Usage
/*
await api.getTime(); // get server time - required
const { totalBalance } = (await api.get(
	"/main/api/v2/accounting/account2/BTC",
)) as { totalBalance: number }; // get balance settings
console.log(`NiceHash total balance: ${totalBalance} BTC`);
*/