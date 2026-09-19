from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # --- Required for real AI calls ---
    openrouter_api_key: str = ""
    openai_api_key: str = ""

    # --- Mock mode ---
    mock_ai: bool = True

    # --- Models and settings ---
    refiner_model: str = "anthropic/claude-sonnet-5"
    compiler_model: str = "anthropic/claude-sonnet-5"

    image_model: str = "gpt-image-2.5-sunburst"
    image_quality: str = "low"
    image_size: str = "1024x1024"
    candidate_count: int = 4

    # Where the SQLite file and images live (relative to the backend directory)
    data_dir: str = "../data"

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def data_dir_path(self) -> Path:
        path = Path(self.data_dir)
        if not path.is_absolute():
            path = (BACKEND_DIR / path).resolve()
        return path


settings = Settings()
