import type { SVGProps } from "react";

/** Small outline icons (24px grid, drawn with the current text color). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HeartIcon = ({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
  </Icon>
);

export const BookmarkIcon = ({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? "currentColor" : "none"}>
    <path d="M6.5 4h11v16.5L12 16.8 6.5 20.5Z" />
  </Icon>
);

export const CommentIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4.5 5.5h15v10.5H10l-4.5 3.5V16h-1Z" />
  </Icon>
);

export const PlayIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5Z" />
  </Icon>
);

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="5" y="10.5" width="14" height="9" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Icon>
);
