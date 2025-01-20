export default function Sunset() {
    return (
      <section>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 items-center">
          {/* Hero content */}
          <div className="pt-12 md:pt-20">
            {/* Section header */}
            <div className="pb-12 text-center">
              <h1
                className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,theme(colors.gray.200),theme(colors.blue.200),theme(colors.gray.50),theme(colors.blue.300),theme(colors.gray.200))] bg-[length:200%_auto] bg-clip-text pb-5 font-nacelle text-4xl font-semibold text-transparent md:text-5xl"
                data-aos="fade-up"
              >
                Split is currently inactive
              </h1>
              <div className="mx-auto max-w-3xl">
                <p
                  className="mb-8 text-xl text-blue-200/65"
                  data-aos="fade-up"
                  data-aos-delay={200}
                >
                  Any social profile, tokens, or other assets claiming to be
                  associated with this project are fraudulent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  