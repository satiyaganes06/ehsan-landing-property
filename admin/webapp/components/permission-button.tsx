'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/animate-ui/components/radix/tooltip';
import { useSession } from '@/lib/session';
import { permissionHint, type Action, type Resource } from '@/lib/permissions';

type ButtonProps = React.ComponentProps<typeof Button>;

interface PermissionButtonProps extends ButtonProps {
  resource: Resource;
  action: Action;
}

/**
 * An action the current role may not be allowed to take.
 *
 * Deliberately disabled-with-a-reason rather than hidden: a viewer who cannot
 * find the button assumes the panel is broken, while a viewer who sees it
 * greyed out with "your role can't create projects" understands the system.
 * Hiding is reserved for whole sections the role cannot read at all.
 */
export function PermissionButton({ resource, action, children, ...props }: PermissionButtonProps) {
  const { can } = useSession();
  const allowed = can(resource, action);

  if (allowed) {
    return <Button {...props}>{children}</Button>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button emits no pointer events, so the tooltip needs a
            wrapper that still receives hover and focus. */}
        <span tabIndex={0} className="inline-flex">
          <Button {...props} disabled aria-disabled className="pointer-events-none">
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{permissionHint(resource, action)}</TooltipContent>
    </Tooltip>
  );
}
