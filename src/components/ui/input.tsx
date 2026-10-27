import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded border border-line bg-paper-card px-3 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded border border-line bg-paper-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none",
          className,
        )}
        {...rest}
      />
    );
  },
);
