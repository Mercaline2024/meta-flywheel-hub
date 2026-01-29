import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MetaAdAccount } from "@/lib/meta/useMetaAssets";

type Props = {
  options: MetaAdAccount[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function AdAccountMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecciona cuentas",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const label = value.length === 0 ? placeholder : `${value.length} cuenta(s) seleccionada(s)`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between">
          <span className="truncate text-left">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cuenta…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selectedSet.has(opt.meta_ad_account_id);
                return (
                  <CommandItem
                    key={opt.meta_ad_account_id}
                    value={opt.name}
                    onSelect={() => {
                      const next = new Set(selectedSet);
                      if (checked) next.delete(opt.meta_ad_account_id);
                      else next.add(opt.meta_ad_account_id);
                      onChange(Array.from(next));
                    }}
                    className="gap-2"
                  >
                    <Checkbox checked={checked} aria-label={`Seleccionar ${opt.name}`} />
                    <span className="flex-1 truncate">{opt.name}</span>
                    {checked ? <Check className="h-4 w-4 opacity-70" aria-hidden="true" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
