"use client";

import { useEffect } from "react";
import { getCalApi } from "@calcom/embed-react";

const CAL_NAMESPACE = "floop";
const CAL_LINK = "dharamlokhandwala/floop";

export function CalDemoButton() {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", {
        cssVarsPerTheme: {
          light: { "cal-brand": "var(--color-floop-blue)" },
          dark: { "cal-brand": "#4446ff" },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  return (
    <button
      type="button"
      data-cal-namespace={CAL_NAMESPACE}
      data-cal-link={CAL_LINK}
      data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
    >
      Schedule a demo
    </button>
  );
}
