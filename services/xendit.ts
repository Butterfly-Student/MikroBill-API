// src/services/xendit.ts
export async function createXenditInvoice({
	external_id,
	amount,
	payer_email,
	description,
	success_redirect_url,
}: {
	external_id: string;
	amount: number;
	payer_email?: string;
	description?: string;
	success_redirect_url?: string;
}) {
	const res = await fetch("https://api.xendit.co/v3/invoices", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${btoa(`${process.env.XENDIT_SECRET_KEY}:`)}`,
		},
		body: JSON.stringify({
			external_id,
			amount,
			payer_email,
			description,
			success_redirect_url,
		}),
	});

	if (!res.ok) {
		throw new Error(`Xendit API error: ${res.status} ${await res.text()}`);
	}

	return res.json();
}
