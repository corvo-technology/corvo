import { formatCron } from "@corvo/core";
import { afterEach, describe, expect, it } from "vitest";
import { cronLabels } from "./cron";
import { resetI18nForTests } from "./i18n";

afterEach(() => resetI18nForTests());

describe("cronLabels", () => {
  it("keeps English schedules readable, including an interval of one", () => {
    const labels = cronLabels("en");
    expect(formatCron("*/1 * * * *", labels)).toBe("Every 1 minute");
    expect(formatCron("0 8 * * 1-5", labels)).toBe("Weekdays at 8:00 AM");
  });

  it("translates schedules into Portuguese on mobile surfaces", () => {
    resetI18nForTests("pt-BR");
    const labels = cronLabels();
    expect(formatCron("0 8 * * 1-5", labels)).toBe("Dias da semana às 8:00 AM");
    expect(formatCron("*/5 * * * *", labels)).toBe("A cada 5 minutos");
    expect(formatCron("0 9 * * 1,3,5", labels)).toBe(
      "Toda segunda-feira, quarta-feira e sexta-feira às 9:00 AM",
    );
  });

  it("translates schedules into Spanish on mobile surfaces", () => {
    resetI18nForTests("es");
    const labels = cronLabels();
    expect(formatCron("0 8 * * 1-5", labels)).toBe("Días laborables a las 8:00 AM");
    expect(formatCron("*/5 * * * *", labels)).toBe("Cada 5 minutos");
    expect(formatCron("0 9 * * 1,3", labels)).toBe("Cada lunes y miércoles a las 9:00 AM");
  });

  it("names a fixed minute every few hours in each language", () => {
    expect(formatCron("43 */2 * * *", cronLabels("en"))).toBe("Every 2 hours at :43");
    resetI18nForTests("pt-BR");
    expect(formatCron("43 */2 * * *", cronLabels())).toBe("A cada 2 horas no minuto 43");
    resetI18nForTests("es");
    expect(formatCron("43 */2 * * *", cronLabels())).toBe("Cada 2 horas en el minuto 43");
  });
});
