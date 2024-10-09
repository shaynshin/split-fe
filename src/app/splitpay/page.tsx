import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./ReactSwagger";

export default async function IndexPage() {
  const spec = await getApiDocs();
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="min-h-[calc(100vh-15.5rem)]">
          <ReactSwagger spec={spec} />
        </div>
      </div>
    </section>
  );
}
