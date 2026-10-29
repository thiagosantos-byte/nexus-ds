import { useId, useRef, useState, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import "./selection.css";

export type Choice = { value: string; label: string; description?: string };

// Editable ARIA combobox. Only choosing an option changes the underlying ID.
export function SearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Selecione",
  required = false,
  disabled = false,
}: {
  options: Choice[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected ? "Selecione uma opção da lista." : "",
    );
  }, [required, selected]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  function choose(option: Choice) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }
  return (
    <div
      className="search-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <div className="search-select-control">
        <Search size={17} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-required={required}
          aria-activedescendant={
            open && filtered[active] ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder={selected?.label ?? placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                Math.max(
                  0,
                  Math.min(
                    filtered.length - 1,
                    current + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (filtered[active]) choose(filtered[active]);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {open && (
        <div className="search-select-popup">
          <ul id={`${id}-list`} role="listbox" aria-label={label}>
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={value === option.value}
                className={active === index ? "highlighted" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                {value === option.value && (
                  <Check size={17} aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
          {!filtered.length && <p role="status">Nenhuma opção encontrada.</p>}
          <span className="selection-hint">
            Digite para buscar · ↑ ↓ para navegar · Enter para selecionar
          </span>
        </div>
      )}
    </div>
  );
}

export function MultiChoice({
  label,
  options,
  value,
  onChange,
  empty,
  disabled = false,
}: {
  label: string;
  options: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
  empty: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <fieldset className="multi-choice" disabled={disabled}>
      <legend>{label}</legend>
      <div className="selection-summary">
        <span>Escolha os itens que farão parte da banca.</span>
        <strong aria-live="polite">{value.length} selecionados</strong>
      </div>
      <label className="selection-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Buscar em {label}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou informação…"
        />
      </label>
      {value.length > 0 && (
        <div className="selection-chips" aria-label={`Seleção em ${label}`}>
          {options
            .filter((option) => value.includes(option.value))
            .map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() =>
                  onChange(value.filter((id) => id !== option.value))
                }
                aria-label={`Remover ${option.label}`}
              >
                <span>{option.label}</span>
                <X size={13} aria-hidden="true" />
              </button>
            ))}
        </div>
      )}
      <div className="selection-options">
        {filtered.map((option) => (
          <label
            className={`selection-option ${value.includes(option.value) ? "selected" : ""}`}
            key={option.value}
          >
            <input
              type="checkbox"
              aria-label={option.label}
              checked={value.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((id) => id !== option.value),
                )
              }
            />
            <span>
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
          </label>
        ))}
      </div>
      {!filtered.length && (
        <p className="selection-empty">
          {options.length ? "Nenhum item corresponde à busca." : empty}
        </p>
      )}
    </fieldset>
  );
}
