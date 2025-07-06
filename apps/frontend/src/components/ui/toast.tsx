"use client";

import { cn } from "@/lib/utils";
import { CircleCheck, CircleX, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Toast component.
 * 
 * @param props - The props object.
 * @param props.success - The success status.
 * @param props.message - The message to be displayed.
 * @param [props.position="bottom-right"] - The position of the toast.
 * @param [props.duration=8000] - The duration of the toast.
 * @returns The toast.
 */
export function Toast({
	success,
	message,
	position = "bottom-right",
	duration = 8000
}: {
	success: boolean;
	message: string;
	position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
	duration?: number;
}) {
	const Icon = success ? CircleCheck : CircleX;
	const IconClass = cn(
		"w-6 h-6 rounded-full text-card",
		success ? "bg-success" : "bg-destructive"
	);

	toast.custom((t) => (
		<Card className="w-full max-w-xs p-4 rounded-lg shadow-lg">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div><Icon className={IconClass} /></div>
					<span>{message}</span>
				</div>
				<Button
					size="icon"
					variant="destructive"
					onClick={() => toast.dismiss(t.id)}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</Card>
	), {
		position,
		duration,
		removeDelay: 300,
	});
}