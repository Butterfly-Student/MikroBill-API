import { Voucher, VoucherBatch, Profile } from "@/types/generate-voucher";

export const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(amount);
};

export const calculateStats = (
	batches: VoucherBatch[],
	profiles: Profile[]
) => {
	const totalBatches = batches.length;
	const totalGenerated = batches.reduce(
		(sum, batch) => sum + batch.total_generated,
		0
	);
	const activeBatches = batches.filter((b) => b.is_active).length;
	const totalRevenue = batches.reduce((sum, batch) => {
		const profile = profiles.find((p) => p.id === batch.profile_id);
		return sum + (profile ? profile.sell_price * batch.total_generated : 0);
	}, 0);

	return {
		totalBatches,
		totalGenerated,
		activeBatches,
		totalRevenue,
	};
};

export const exportToCSV = (vouchers: Voucher[], batchName: string) => {
	const csvContent = [
		"Username,Password,Profile,Validity,Status",
		...vouchers.map(
			(v: Voucher) =>
				`${v.username},${v.password},${v.profile},${v.validity},${
					v.used ? "Used" : "Unused"
				}`
		),
	].join("\n");

	const blob = new Blob([csvContent], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `vouchers-${batchName}.csv`;
	a.click();
	URL.revokeObjectURL(url);
};
