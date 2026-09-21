import React from 'react';
import { cn } from '@/lib/utils';

export const Table = React.forwardRef(({ className, containerClassName, ...props }, ref) => (
  <div className={cn('relative w-full max-w-full overflow-x-auto', containerClassName)}>
    <table ref={ref} className={cn('w-full min-w-max caption-bottom text-sm', className)} {...props} />
  </div>
));

export const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));

export const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));

export const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />
));

export const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
));

export const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('h-12 whitespace-nowrap px-3 text-left align-middle font-medium text-muted-foreground sm:px-4', className)} {...props} />
));

export const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-3 align-middle sm:p-4', className)} {...props} />
));

export const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));

Table.displayName = 'Table';
TableHeader.displayName = 'TableHeader';
TableBody.displayName = 'TableBody';
TableFooter.displayName = 'TableFooter';
TableHead.displayName = 'TableHead';
TableRow.displayName = 'TableRow';
TableCell.displayName = 'TableCell';
TableCaption.displayName = 'TableCaption';
