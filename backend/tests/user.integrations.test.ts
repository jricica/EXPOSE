import supertest from "supertest";
import app from "../src/server";

const request = supertest(app);

describe("General API", () => {
    it("should return API is running", async () => {
        const response = await request.get("/");
        expect(response.text).toBe("API is running");
    });
});
