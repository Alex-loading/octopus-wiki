begin;

alter table public.demos
  drop constraint demos_status_check,
  add constraint demos_status_check
    check (status in ('live', 'wip', 'planned', 'terminated'));

commit;
