import { renderOgImage } from "@/lib/og-image";

export {
  OG_CONTENT_TYPE as contentType,
  OG_SIZE as size,
} from "@/lib/og-image";

export const alt =
  "Tally: stock control for a retailer with several stores and a warehouse";

const OpenGraphImage = async () =>
  await renderOgImage({
    eyebrow: "Stock control",
    subtitle:
      "Deliveries, transfers, counts, sales and reports for five stores and a warehouse.",
    title: ["Every shelf, every branch.", "One ledger."],
  });

export default OpenGraphImage;
