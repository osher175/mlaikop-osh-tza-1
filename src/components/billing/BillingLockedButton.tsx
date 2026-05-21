import React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRequireCanWriteAction } from '@/hooks/useRequireCanWriteAction';

interface BillingLockedButtonProps extends ButtonProps {
  /** If true, this button is bypass-locked (e.g. cancel/close buttons). */
  alwaysEnabled?: boolean;
}

/**
 * Drop-in replacement for <Button> that disables itself when the
 * current business cannot write (billing status != active/trial).
 * Shows a tooltip and routes owners to /subscribe on click.
 */
export const BillingLockedButton = React.forwardRef<
  HTMLButtonElement,
  BillingLockedButtonProps
>(({ alwaysEnabled, disabled, onClick, children, ...rest }, ref) => {
  const { canWrite, isReadOnly, tooltipMessage, blockedClick } =
    useRequireCanWriteAction();

  if (alwaysEnabled || !isReadOnly) {
    return (
      <Button ref={ref} disabled={disabled} onClick={onClick} {...rest}>
        {children}
      </Button>
    );
  }

  // Read-only: render a visually-disabled but still-clickable button so we
  // can show a toast / route owners to /subscribe.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              ref={ref}
              {...rest}
              disabled={false}
              aria-disabled
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                blockedClick();
              }}
              className={`${rest.className ?? ''} opacity-50 cursor-not-allowed`}
            >
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltipMessage}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

BillingLockedButton.displayName = 'BillingLockedButton';
