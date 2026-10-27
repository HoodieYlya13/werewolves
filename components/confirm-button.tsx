"use client";

import { useI18n } from "@/components/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  title: string;
  description: string;
  /** The confirm button's label. */
  action: string;
  onConfirm: () => void;
  /** Acts straight away, without asking. */
  skip?: boolean;
};

/** A button that asks for confirmation in a modal before doing something hard to undo. */
export function ConfirmButton({ title, description, action, onConfirm, skip, ...button }: ConfirmButtonProps) {
  const { dict } = useI18n();
  if (skip) return <Button {...button} onClick={onConfirm} />;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button {...button} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dict.host.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
